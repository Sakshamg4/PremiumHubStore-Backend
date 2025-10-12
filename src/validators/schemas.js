import { z } from 'zod';

// Auth schemas
export const LoginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters')
});

export const RegisterSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  role: z.enum(['admin', 'manager', 'sales', 'finance', 'viewer']).default('viewer'),
  phone: z.string().optional()
});

// User schemas
export const UpdateUserSchema = z.object({
  name: z.string().min(2).trim().optional(),
  phone: z.string().optional(),
  role: z.enum(['admin', 'manager', 'sales', 'finance', 'viewer']).optional(),
  status: z.enum(['active', 'disabled']).optional()
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(6),
  newPassword: z.string().min(6, 'New password must be at least 6 characters')
});

// Client schemas
export const CreateClientSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional()
});

export const UpdateClientSchema = CreateClientSchema.partial();

// Vendor schemas
export const CreateVendorSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  notes: z.string().optional()
});

export const UpdateVendorSchema = CreateVendorSchema.partial();

// Product schemas
export const CreateProductSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').trim(),
  sku: z.string().optional(),
  category: z.string().optional(),
  defaultVendorId: z.string().optional(),
  baseCostPaise: z.number().int().nonnegative().optional(),
  defaultPricePaise: z.number().int().nonnegative().optional(),
  defaultValidityMonths: z.number().int().positive().optional(),
  defaultWarrantyMonths: z.number().int().nonnegative().optional(),
  activationMethods: z.array(z.enum(['LOGIN_CREDENTIALS', 'COUPON_CODE', 'EMAIL_INVITE'])).min(1),
  notes: z.string().optional()
});

export const UpdateProductSchema = CreateProductSchema.partial();

// Coupon schemas
export const CreateCouponSchema = z.object({
  code: z.string().min(3, 'Code must be at least 3 characters').trim().toUpperCase(),
  productId: z.string().optional(),
  discountType: z.enum(['PERCENT', 'FLAT']).optional(),
  discountValuePaise: z.number().int().nonnegative().optional(),
  maxUses: z.number().int().positive().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  isActive: z.boolean().default(true)
});

export const UpdateCouponSchema = CreateCouponSchema.partial();

export const ValidateCouponSchema = z.object({
  code: z.string().min(3).trim(),
  productId: z.string().optional()
});

// Purchase schemas
export const CreatePurchaseSchema = z.object({
  orderId: z.string().min(3, 'Order ID must be at least 3 characters').trim(),
  sourcePlatform: z.enum(['WHATSAPP', 'INSTAGRAM', 'WEBSITE', 'OTHER']).default('WHATSAPP'),
  sourceRef: z.string().optional(),
  clientId: z.string().min(1, 'Client ID is required'),
  productId: z.string().min(1, 'Product ID is required'),
  vendorId: z.string().optional(),
  purchaseDate: z.string().datetime(),
  validity: z.object({
    durationMonths: z.number().int().positive().optional(),
    startDate: z.string().datetime().optional()
  }).optional(),
  warranty: z.object({
    hasWarranty: z.boolean().default(false),
    months: z.number().int().nonnegative().optional()
  }).optional(),
  activation: z.object({
    method: z.enum(['LOGIN_CREDENTIALS', 'COUPON_CODE', 'EMAIL_INVITE']),
    credentials: z.object({
      username: z.string().optional(),
      password: z.string().optional()
    }).optional(),
    couponCode: z.string().optional(),
    emailInvite: z.object({
      invitedEmail: z.string().email().optional()
    }).optional()
  }),
  amounts: z.object({
    clientPayTotalPaise: z.number().int().nonnegative(),
    vendorPayTotalPaise: z.number().int().nonnegative(),
    discountPaise: z.number().int().nonnegative().default(0),
    taxesPaise: z.number().int().nonnegative().default(0),
    feesPaise: z.number().int().nonnegative().default(0),
    currency: z.literal('INR').default('INR')
  }),
  people: z.object({
    vendorContactName: z.string().optional(),
    vendorContactPhone: z.string().optional()
  }).optional(),
  status: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).default('OPEN')
});

export const UpdatePurchaseSchema = CreatePurchaseSchema.partial();

// Payment schemas
export const CreatePaymentSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase ID is required'),
  type: z.enum(['CLIENT', 'VENDOR']),
  amountPaise: z.number().int().positive('Amount must be positive'),
  paidOn: z.string().datetime(),
  method: z.enum(['UPI', 'CARD', 'BANK', 'CASH', 'OTHER']).optional(),
  reference: z.string().optional(),
  screenshotUrl: z.string().url().optional().or(z.literal('')),
  notes: z.string().optional()
});

export const UpdatePaymentSchema = CreatePaymentSchema.partial();

// Query schemas
export const PaginationSchema = z.object({
  page: z.string().transform(val => parseInt(val) || 1).pipe(z.number().int().positive()),
  limit: z.string().transform(val => Math.min(parseInt(val) || 20, 100)).pipe(z.number().int().positive()),
  sort: z.string().optional(),
  order: z.enum(['asc', 'desc']).default('desc')
});

export const DateRangeSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional()
});

export const PurchaseQuerySchema = PaginationSchema.merge(DateRangeSchema).extend({
  status: z.enum(['OPEN', 'COMPLETED', 'CANCELLED']).optional(),
  clientId: z.string().optional(),
  vendorId: z.string().optional(),
  productId: z.string().optional(),
  search: z.string().optional()
});

export const PaymentQuerySchema = PaginationSchema.merge(DateRangeSchema).extend({
  purchaseId: z.string().optional(),
  type: z.enum(['CLIENT', 'VENDOR']).optional()
});

export const AnalyticsQuerySchema = DateRangeSchema.extend({
  granularity: z.enum(['week', 'month', 'year']).default('month')
});

export const TopAnalyticsSchema = DateRangeSchema.extend({
  by: z.enum(['products', 'vendors']),
  limit: z.string().transform(val => Math.min(parseInt(val) || 5, 20)).pipe(z.number().int().positive())
});

export const ExpiringQuerySchema = z.object({
  days: z.string().transform(val => parseInt(val) || 30).pipe(z.number().int().positive())
});
