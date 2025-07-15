const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic information
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 8
  },

  // Organization and role
  organization: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['admin', 'manager', 'analyst', 'viewer'],
    default: 'analyst'
  },
  department: {
    type: String,
    default: ''
  },

  // CRM Integration preferences
  preferredCRM: {
    type: String,
    enum: ['salesforce'],
    default: 'salesforce'
  },

  // Permissions
  permissions: {
    canUpload: {
      type: Boolean,
      default: true
    },
    canEditTranscripts: {
      type: Boolean,
      default: true
    },
    canSyncCRM: {
      type: Boolean,
      default: true
    },
    canGenerateDocuments: {
      type: Boolean,
      default: true
    },
    canViewAnalytics: {
      type: Boolean,
      default: true
    },
    canManageUsers: {
      type: Boolean,
      default: false
    }
  },

  // Profile information
  profilePicture: {
    type: String,
    default: ''
  },
  phoneNumber: {
    type: String,
    default: ''
  },
  timezone: {
    type: String,
    default: 'UTC'
  },

  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: null
  },

  // API tokens for external integrations
  apiTokens: [{
    name: String,
    token: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastUsed: {
      type: Date,
      default: null
    }
  }],

  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ organization: 1 });
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Pre-save middleware to update updatedAt
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to get full name
userSchema.methods.getFullName = function() {
  return `${this.firstName} ${this.lastName}`;
};

// Method to check if user has permission
userSchema.methods.hasPermission = function(permission) {
  return this.permissions[permission] || false;
};

// Method to check if user is admin
userSchema.methods.isAdmin = function() {
  return this.role === 'admin';
};

// Method to check if user is manager or admin
userSchema.methods.isManagerOrAdmin = function() {
  return ['admin', 'manager'].includes(this.role);
};

// Static method to find by email
userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ isActive: true });
};

// Static method to find by organization
userSchema.statics.findByOrganization = function(organization) {
  return this.find({ organization: organization, isActive: true });
};

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Ensure virtual fields are serialized
userSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    delete ret.password;
    delete ret.apiTokens;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema); 