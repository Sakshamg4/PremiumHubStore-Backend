import express from 'express';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';
import { authenticate } from '../middleware/auth.js';
import { AnalyticsQuerySchema, TopAnalyticsSchema, ExpiringQuerySchema } from '../validators/schemas.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/analytics/summary
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to, granularity = 'month' } = req.query;
    
    let dateFilter = {};
    if (from || to) {
      dateFilter.purchaseDate = {};
      if (from) dateFilter.purchaseDate.$gte = new Date(from);
      if (to) dateFilter.purchaseDate.$lte = new Date(to);
    }

    // Get overall totals
    const [purchaseTotals, paymentTotals] = await Promise.all([
      Purchase.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: null,
            totalPurchases: { $sum: 1 },
            clientPaymentsPaise: { $sum: '$amounts.clientPayTotalPaise' },
            vendorPaymentsPaise: { $sum: '$amounts.vendorPayTotalPaise' },
            feesPaise: { $sum: { $ifNull: ['$amounts.feesPaise', 0] } }
          }
        }
      ]),
      Payment.aggregate([
        ...(Object.keys(dateFilter).length > 0 ? [
          {
            $lookup: {
              from: 'purchases',
              localField: 'purchaseId',
              foreignField: '_id',
              as: 'purchase'
            }
          },
          { $unwind: '$purchase' },
          { $match: { 'purchase.purchaseDate': dateFilter.purchaseDate } }
        ] : []),
        {
          $group: {
            _id: '$type',
            totalPaidPaise: { $sum: '$amountPaise' }
          }
        }
      ])
    ]);

    const totals = purchaseTotals[0] || {
      totalPurchases: 0,
      clientPaymentsPaise: 0,
      vendorPaymentsPaise: 0,
      feesPaise: 0
    };

    const clientPayments = paymentTotals.find(p => p._id === 'CLIENT')?.totalPaidPaise || 0;
    const vendorPayments = paymentTotals.find(p => p._id === 'VENDOR')?.totalPaidPaise || 0;

    // Calculate profit
    const profitPaise = totals.clientPaymentsPaise - totals.vendorPaymentsPaise - totals.feesPaise;
    const realizedProfitPaise = clientPayments - vendorPayments;

    // Get time series data
    let groupByFormat;
    switch (granularity) {
      case 'week':
        groupByFormat = { $dateToString: { format: '%Y-W%U', date: '$purchaseDate' } };
        break;
      case 'year':
        groupByFormat = { $dateToString: { format: '%Y', date: '$purchaseDate' } };
        break;
      default: // month
        groupByFormat = { $dateToString: { format: '%Y-%m', date: '$purchaseDate' } };
    }

    const timeSeriesData = await Purchase.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: groupByFormat,
          purchases: { $sum: 1 },
          clientTotal: { $sum: '$amounts.clientPayTotalPaise' },
          vendorTotal: { $sum: '$amounts.vendorPayTotalPaise' },
          fees: { $sum: { $ifNull: ['$amounts.feesPaise', 0] } }
        }
      },
      {
        $addFields: {
          profit: { $subtract: ['$clientTotal', { $add: ['$vendorTotal', '$fees'] }] }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      range: { from, to, granularity },
      totals: {
        totalPurchases: totals.totalPurchases,
        clientPaymentsPaise: totals.clientPaymentsPaise,
        vendorPaymentsPaise: totals.vendorPaymentsPaise,
        profitPaise,
        realizedClientPaymentsPaise: clientPayments,
        realizedVendorPaymentsPaise: vendorPayments,
        realizedProfitPaise,
        feesPaise: totals.feesPaise
      },
      byPeriod: timeSeriesData.map(item => ({
        period: item._id,
        purchases: item.purchases,
        client: item.clientTotal,
        vendor: item.vendorTotal,
        profit: item.profit,
        fees: item.fees
      }))
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/analytics/top
router.get('/top', async (req, res, next) => {
  try {
    const { by, limit = 5, from, to } = req.query;
    
    let dateFilter = {};
    if (from || to) {
      dateFilter.purchaseDate = {};
      if (from) dateFilter.purchaseDate.$gte = new Date(from);
      if (to) dateFilter.purchaseDate.$lte = new Date(to);
    }

    let pipeline = [{ $match: dateFilter }];
    let populateField = '';

    if (by === 'products') {
      pipeline.push(
        {
          $group: {
            _id: '$productId',
            totalRevenue: { $sum: '$amounts.clientPayTotalPaise' },
            totalProfit: {
              $sum: {
                $subtract: [
                  '$amounts.clientPayTotalPaise',
                  { $add: ['$amounts.vendorPayTotalPaise', { $ifNull: ['$amounts.feesPaise', 0] }] }
                ]
              }
            },
            purchaseCount: { $sum: 1 }
          }
        },
        { $sort: { totalRevenue: -1 } },
        { $limit: parseInt(limit) }
      );
      populateField = 'productId';
    } else if (by === 'vendors') {
      pipeline.push(
        {
          $group: {
            _id: '$vendorId',
            totalPayout: { $sum: '$amounts.vendorPayTotalPaise' },
            totalRevenue: { $sum: '$amounts.clientPayTotalPaise' },
            purchaseCount: { $sum: 1 }
          }
        },
        { $sort: { totalPayout: -1 } },
        { $limit: parseInt(limit) }
      );
      populateField = 'vendorId';
    }

    const results = await Purchase.aggregate(pipeline);

    // Populate the referenced documents
    if (results.length > 0) {
      const Model = by === 'products' ? 
        (await import('../models/Product.js')).default : 
        (await import('../models/Vendor.js')).default;
      
      const populatedResults = await Promise.all(
        results.map(async (item) => {
          if (item._id) {
            const doc = await Model.findById(item._id).select('name');
            return { ...item, [populateField]: doc };
          }
          return item;
        })
      );

      res.json({ results: populatedResults });
    } else {
      res.json({ results: [] });
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/analytics/expiring
router.get('/expiring', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + parseInt(days));

    const expiringPurchases = await Purchase.find({
      'validity.endDate': {
        $gte: now,
        $lte: futureDate
      },
      status: { $ne: 'CANCELLED' }
    })
    .populate('clientId', 'name email phone')
    .populate('productId', 'name')
    .populate('vendorId', 'name')
    .sort({ 'validity.endDate': 1 });

    const grouped = expiringPurchases.reduce((acc, purchase) => {
      const daysUntilExpiry = Math.ceil((purchase.validity.endDate - now) / (1000 * 60 * 60 * 24));
      
      if (daysUntilExpiry <= 7) {
        acc.thisWeek.push(purchase);
      } else if (daysUntilExpiry <= 30) {
        acc.thisMonth.push(purchase);
      } else {
        acc.later.push(purchase);
      }
      
      return acc;
    }, { thisWeek: [], thisMonth: [], later: [] });

    res.json({
      summary: {
        total: expiringPurchases.length,
        thisWeek: grouped.thisWeek.length,
        thisMonth: grouped.thisMonth.length,
        later: grouped.later.length
      },
      purchases: {
        thisWeek: grouped.thisWeek,
        thisMonth: grouped.thisMonth,
        later: grouped.later
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/v1/analytics/outstanding
router.get('/outstanding', async (req, res, next) => {
  try {
    const [clientDues, vendorDues] = await Promise.all([
      Purchase.aggregate([
        { $match: { 'settlement.clientDuePaise': { $gt: 0 } } },
        {
          $group: {
            _id: '$clientId',
            totalDuePaise: { $sum: '$settlement.clientDuePaise' },
            purchaseCount: { $sum: 1 }
          }
        },
        { $sort: { totalDuePaise: -1 } }
      ]),
      Purchase.aggregate([
        { $match: { 'settlement.vendorDuePaise': { $gt: 0 } } },
        {
          $group: {
            _id: '$vendorId',
            totalDuePaise: { $sum: '$settlement.vendorDuePaise' },
            purchaseCount: { $sum: 1 }
          }
        },
        { $sort: { totalDuePaise: -1 } }
      ])
    ]);

    // Populate client and vendor data
    const [populatedClientDues, populatedVendorDues] = await Promise.all([
      Promise.all(clientDues.map(async (item) => {
        if (item._id) {
          const client = await (await import('../models/Client.js')).default
            .findById(item._id).select('name email phone');
          return { ...item, client };
        }
        return item;
      })),
      Promise.all(vendorDues.map(async (item) => {
        if (item._id) {
          const vendor = await (await import('../models/Vendor.js')).default
            .findById(item._id).select('name contactName');
          return { ...item, vendor };
        }
        return item;
      }))
    ]);

    const totalClientDue = clientDues.reduce((sum, item) => sum + item.totalDuePaise, 0);
    const totalVendorDue = vendorDues.reduce((sum, item) => sum + item.totalDuePaise, 0);

    res.json({
      summary: {
        totalClientDuePaise: totalClientDue,
        totalVendorDuePaise: totalVendorDue,
        clientCount: clientDues.length,
        vendorCount: vendorDues.length
      },
      clientDues: populatedClientDues,
      vendorDues: populatedVendorDues
    });
  } catch (error) {
    next(error);
  }
});

export default router;
