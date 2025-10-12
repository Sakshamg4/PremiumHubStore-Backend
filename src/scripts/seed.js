import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Client from '../models/Client.js';
import Vendor from '../models/Vendor.js';
import Product from '../models/Product.js';
import Purchase from '../models/Purchase.js';
import Payment from '../models/Payment.js';

dotenv.config();

const seedData = async () => {
  try {
    console.log('🌱 Starting database seed...');
    
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('📦 Connected to MongoDB');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Client.deleteMany({}),
      Vendor.deleteMany({}),
      Product.deleteMany({}),
      Purchase.deleteMany({}),
      Payment.deleteMany({})
    ]);
    console.log('🧹 Cleared existing data');

    // Create admin user
    const adminUser = new User({
      name: 'Admin User',
      email: 'admin@example.com',
      passwordHash: 'password123',
      role: 'admin',
      phone: '+91-9876543210'
    });
    await adminUser.save();
    console.log('👤 Created admin user');

    // Create sample clients
    const clients = await Client.insertMany([
      {
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+91-9876543211',
        whatsapp: '+91-9876543211',
        tags: ['premium', 'regular']
      },
      {
        name: 'Jane Smith',
        email: 'jane@example.com',
        phone: '+91-9876543212',
        tags: ['new']
      },
      {
        name: 'Tech Corp Ltd',
        email: 'contact@techcorp.com',
        phone: '+91-9876543213',
        tags: ['corporate', 'bulk']
      }
    ]);
    console.log('👥 Created sample clients');

    // Create sample vendors
    const vendors = await Vendor.insertMany([
      {
        name: 'Software Solutions Inc',
        contactName: 'Mike Johnson',
        email: 'mike@softwaresolutions.com',
        phone: '+91-9876543214',
        whatsapp: '+91-9876543214'
      },
      {
        name: 'Digital Services Co',
        contactName: 'Sarah Wilson',
        email: 'sarah@digitalservices.com',
        phone: '+91-9876543215'
      }
    ]);
    console.log('🏢 Created sample vendors');

    // Create sample products
    const products = await Product.insertMany([
      {
        name: 'Premium Software License',
        sku: 'PSL-001',
        category: 'Software',
        defaultVendorId: vendors[0]._id,
        baseCostPaise: 500000, // ₹5000
        defaultPricePaise: 700000, // ₹7000
        defaultValidityMonths: 12,
        defaultWarrantyMonths: 6,
        activationMethods: ['LOGIN_CREDENTIALS', 'EMAIL_INVITE']
      },
      {
        name: 'Cloud Storage Plan',
        sku: 'CSP-001',
        category: 'Cloud Services',
        defaultVendorId: vendors[1]._id,
        baseCostPaise: 200000, // ₹2000
        defaultPricePaise: 300000, // ₹3000
        defaultValidityMonths: 6,
        activationMethods: ['COUPON_CODE']
      },
      {
        name: 'Digital Marketing Suite',
        sku: 'DMS-001',
        category: 'Marketing',
        defaultVendorId: vendors[0]._id,
        baseCostPaise: 800000, // ₹8000
        defaultPricePaise: 1200000, // ₹12000
        defaultValidityMonths: 12,
        defaultWarrantyMonths: 3,
        activationMethods: ['LOGIN_CREDENTIALS']
      }
    ]);
    console.log('📦 Created sample products');

    // Create sample purchases
    const purchases = await Purchase.insertMany([
      {
        orderId: 'PH-2025-00001',
        sourcePlatform: 'WHATSAPP',
        clientId: clients[0]._id,
        productId: products[0]._id,
        vendorId: vendors[0]._id,
        purchaseDate: new Date('2025-01-15'),
        validity: {
          durationMonths: 12,
          startDate: new Date('2025-01-15')
        },
        warranty: {
          hasWarranty: true,
          months: 6
        },
        activation: {
          method: 'LOGIN_CREDENTIALS',
          credentials: {
            username: 'john_doe_2025'
          }
        },
        amounts: {
          clientPayTotalPaise: 700000,
          vendorPayTotalPaise: 500000,
          feesPaise: 10000,
          currency: 'INR'
        },
        status: 'OPEN',
        createdBy: adminUser._id
      },
      {
        orderId: 'PH-2025-00002',
        sourcePlatform: 'WEBSITE',
        clientId: clients[1]._id,
        productId: products[1]._id,
        vendorId: vendors[1]._id,
        purchaseDate: new Date('2025-01-20'),
        validity: {
          durationMonths: 6,
          startDate: new Date('2025-01-20')
        },
        activation: {
          method: 'COUPON_CODE',
          couponCode: 'CLOUD2025'
        },
        amounts: {
          clientPayTotalPaise: 300000,
          vendorPayTotalPaise: 200000,
          feesPaise: 5000,
          currency: 'INR'
        },
        status: 'COMPLETED',
        createdBy: adminUser._id
      }
    ]);
    console.log('🛒 Created sample purchases');

    // Create sample payments
    await Payment.insertMany([
      {
        purchaseId: purchases[0]._id,
        type: 'CLIENT',
        amountPaise: 350000, // Partial payment
        paidOn: new Date('2025-01-16'),
        method: 'UPI',
        reference: 'UPI-TXN-123456',
        createdBy: adminUser._id
      },
      {
        purchaseId: purchases[1]._id,
        type: 'CLIENT',
        amountPaise: 300000, // Full payment
        paidOn: new Date('2025-01-21'),
        method: 'CARD',
        reference: 'CARD-TXN-789012',
        createdBy: adminUser._id
      },
      {
        purchaseId: purchases[1]._id,
        type: 'VENDOR',
        amountPaise: 200000, // Full vendor payment
        paidOn: new Date('2025-01-22'),
        method: 'BANK',
        reference: 'BANK-TXN-345678',
        createdBy: adminUser._id
      }
    ]);
    console.log('💳 Created sample payments');

    console.log('✅ Database seeded successfully!');
    console.log('\n📋 Login credentials:');
    console.log('Email: admin@example.com');
    console.log('Password: password123');

  } catch (error) {
    console.error('❌ Seed error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('📦 Database connection closed');
  }
};

seedData();
