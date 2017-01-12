'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const constants = require('../constants');
const PAYMENT_PROCESSORS = constants.PAYMENT_PROCESSORS;
const paymentProcessorAdapters = require('./payment-processor-adapters');
const User = require('./user');
const errors = require('storj-service-error-types');

const PaymentProcessor = new mongoose.Schema({
  name: {
    type: String,
    enum: Object.keys(PAYMENT_PROCESSORS).map((key) => {
      return PAYMENT_PROCESSORS[key];
    })
  },
  rawData: [{
    type: mongoose.Schema.Types.Mixed
  }],
  default: {
    type: Boolean
  },
  created: {
    type: Date,
    default: Date.now
  }
});

PaymentProcessor.plugin(SchemaOptions);

PaymentProcessor.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret._id;
    delete ret.rawData;
    delete ret.data;
    delete ret.adapter;
  }
});

PaymentProcessor.virtual('adapter')
  .get(function() {
    return paymentProcessorAdapters[this.name](this);
  });

PaymentProcessor.virtual('data')
  .get(function() {
    return this.adapter.parseData(this.rawData);
  })
  .set(function(data) {
    return this.adapter.serializeData(data);
  });

PaymentProcessor.virtual('defaultPaymentMethod')
  .get(function() {
    return this.adapter.defaultPaymentMethod();
  });

PaymentProcessor.virtual('billingDate')
  .get(function() {
    return this.adapter.billingDate();
  });

PaymentProcessor.virtual('paymentMethods')
  .get(function() {
    return this.adapter.paymentMethods();
  });

PaymentProcessor.pre('save', function(next) {
  this._verifyValidAdapter(next);
  next();
});

PaymentProcessor.methods._verifyValidAdapter = function(next) {
  this.adapter
    .validate()
    .then(() => next())
    .catch((err) => next(new errors.BadRequestError(err)));
};

PaymentProcessor.methods.refresh = function() {
  return User
    .findOne({ _id: this.__parent._id })
    .then((user) => {
      this.__parent.paymentProcessors.splice(
        0,
        this.__parent.paymentProcessors.length,
        user.paymentProcessors
      );
      return this.__parent.paymentProcessors;
    });
};

PaymentProcessor.methods.delete = function() {
  return this.adapter
    .delete(this)
    .then(() => this.remove())
    .then(() => this.__parent.save());
};

PaymentProcessor.methods.addPaymentMethod = function(data) {
  return this.adapter
    .addPaymentMethod(data)
    .then(() => this);
};

module.exports = function(connection) {
  return connection.model('PaymentProcessor', PaymentProcessor);
};

module.exports.Schema = PaymentProcessor;
