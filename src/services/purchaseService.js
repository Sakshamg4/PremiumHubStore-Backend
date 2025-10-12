import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';

/**
 * Update purchase settlement amounts based on payments
 * @param {string} purchaseId - Purchase ID
 */
export const updatePurchaseSettlement = async (purchaseId) => {
  try {
    // Get all payments for this purchase
    const payments = await Payment.find({ purchaseId });
    
    // Calculate totals by type
    const clientPaidPaise = payments
      .filter(p => p.type === 'CLIENT')
      .reduce((sum, p) => sum + p.amountPaise, 0);
    
    const vendorPaidPaise = payments
      .filter(p => p.type === 'VENDOR')
      .reduce((sum, p) => sum + p.amountPaise, 0);

    // Get the purchase to calculate dues
    const purchase = await Purchase.findById(purchaseId);
    if (!purchase) {
      throw new Error('Purchase not found');
    }

    // Calculate dues
    const clientDuePaise = purchase.amounts.clientPayTotalPaise - clientPaidPaise;
    const vendorDuePaise = purchase.amounts.vendorPayTotalPaise - vendorPaidPaise;

    // Update settlement
    purchase.settlement = {
      clientPaidPaise,
      vendorPaidPaise,
      clientDuePaise,
      vendorDuePaise
    };

    // Update status based on settlement
    if (clientDuePaise <= 0 && vendorDuePaise <= 0) {
      purchase.status = 'COMPLETED';
    } else if (purchase.status === 'COMPLETED' && (clientDuePaise > 0 || vendorDuePaise > 0)) {
      purchase.status = 'OPEN';
    }

    await purchase.save();
    return purchase;
  } catch (error) {
    console.error('Error updating purchase settlement:', error);
    throw error;
  }
};

/**
 * Generate next order ID
 * @param {string} prefix - Order ID prefix (default: 'PH')
 * @returns {string} Next order ID
 */
export const generateOrderId = async (prefix = 'PH') => {
  const year = new Date().getFullYear();
  const yearStr = year.toString();
  
  // Find the latest order ID for this year
  const latestPurchase = await Purchase.findOne({
    orderId: { $regex: `^${prefix}-${yearStr}-` }
  }).sort({ orderId: -1 });

  let nextNumber = 1;
  if (latestPurchase) {
    const parts = latestPurchase.orderId.split('-');
    if (parts.length >= 3) {
      const currentNumber = parseInt(parts[2]);
      if (!isNaN(currentNumber)) {
        nextNumber = currentNumber + 1;
      }
    }
  }

  return `${prefix}-${yearStr}-${nextNumber.toString().padStart(5, '0')}`;
};
