'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const constants = require('../constants');
const PAYMENT_PROCESSORS = constants.PAYMENT_PROCESSORS;
const paymentProcessorAdapters = require('./payment-processor-adapters');
const User = require('./user');
const errors = require('storj-service-error-types');

const PaymentProcessor = new mongoose.Schema({
  _id: {
    type: String
  },
  stripe: [{
    type: mongoose.Schema.Types.Mixed,
    get: v => v[0],
    set: v => [v]
  }],
  braintree: [{
    type: mongoose.Schema.Types.Mixed,
    get: v => v[0],
    set: v => [v]
  }],
  heroku: [{
    type: mongoose.Schema.Types.Mixed,
    get: v => v[0],
    set: v => [v]
  }],
  default: {
   enum: Object.keys(PAYMENT_PROCESSORS).map((key) => {
      return PAYMENT_PROCESSORS[key];
    }),
    type: String,
    default: PAYMENT_PROCESSORS.STRIPE
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

//
// PaymentProcessor.virtual('defaultPaymentMethod')
//   .get(function() {
//     return this.adapter.defaultPaymentMethod();
//   });
//
// PaymentProcessor.virtual('billingDate')
//   .get(function() {
//     return this.adapter.billingDate();
//   });
//
// PaymentProcessor.virtual('paymentMethods')
//   .get(function() {
//     return this.adapter.paymentMethods();
//   });

PaymentProcessor.methods.delete = function() {
  return this.adapter
    .delete(this)
    .then(() => this.remove())
};

PaymentProcessor.methods.addPaymentMethod = function(data) {
  return this.adapter
    .addPaymentMethod(data)
    .then(() => this);
};

PaymentProcessor.methods.getBillingDate = function() {

}

PaymentProcessor.methods.getPaymentProcessor = function(options) {
  const email = options.email;
  const name = options.name;
  const default = options.default;
  const all = options.all;

  if (!email) {
    return new errors.BadRequestError('Must provide valid email');
  }

  if (name)
};

PaymentProcessor.methods.create = function(options) {
  const email = options.email;
  const name = options.name;
  const token = options.token;

  // verify name is one of enums
  // verify !this.name


}
//
// /**
//  * Adds payment processor
//  * @param {String} name - name of processor
//  * @param {String} token - user payment token
//  * @returns {Promise.<PaymentProcessor>} - added payment processor
//  */
// User.methods.addPaymentProcessor = function(name, token) {
//   let User = this;
//
//   const existingProcessor = User.getPaymentProcessor(name);
//
//   if (!!existingProcessor) {
//     console.error(
//       `${name} PaymentProcessor already exists ${existingProcessor._id}`
//     );
//     throw new errors.BadRequestError(
//       `${name} PaymentProcessor already exists`
//     );
//   }
//
//   if (!paymentProcessorAdapters[name]) {
//     throw new errors.BadRequestError(`${name} PaymentProcessor is invalid`);
//   }
//
//   const adapter = paymentProcessorAdapters[name](User);
//
//   return adapter
//     .register(token, User.email)
//     .then((processorData) => {
//       const updatedProcessors = User.paymentProcessors.push({
//         name: name,
//         default: User.paymentProcessors.length ? false : true,
//         rawData: adapter.serializeData(processorData)
//       });
//
//       return User
//         .save()
//         .then((result) => result.defaultPaymentProcessor)
//         .catch((err) => new errors.InternalError(err));
//     })
//     .catch((err) => new errors.InternalError(err));
// };
//
// /**
//  * Retrieves specified payment processor
//  * @param {String} processorName
//  * @returns {Object}
//  */
// User.methods.getPaymentProcessor = function(processorName) {
//   return this.paymentProcessors.find((p) => p.name === processorName);
// };

module.exports = function(connection) {
  return connection.model('PaymentProcessor', PaymentProcessor);
};
