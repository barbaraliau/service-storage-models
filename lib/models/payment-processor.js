'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const constants = require('../constants');
const PAYMENT_PROCESSORS = constants.PAYMENT_PROCESSORS;
const paymentProcessorAdapters = require('./payment-processor-adapters');
const User = require('./user');
const errors = require('storj-service-error-types');
const { keysOf, queries } = require('../utils');
const emailErr = 'Must pass in valid email';

const PaymentProcessors = new mongoose.Schema({
  user: {
    type: String,
    unique: true
  },
  [PAYMENT_PROCESSORS.STRIPE]: [{
    type: mongoose.Schema.Types.Mixed,
    get: v => v[0],
    set: v => [v]
  }],
  [PAYMENT_PROCESSORS.BRAINTREE]: [{
    type: mongoose.Schema.Types.Mixed,
    get: v => v[0],
    set: v => [v]
  }],
  [PAYMENT_PROCESSORS.HEROKU]: [{
    type: mongoose.Schema.Types.Mixed,
    get: v => v[0],
    set: v => [v]
  }],
  default: {
   enum: Object.keys(PAYMENT_PROCESSORS).map((key) => {
      return PAYMENT_PROCESSORS[key];
    }),
    type: String
  },
  created: {
    type: Date,
    default: Date.now
  }
});

PaymentProcessors.plugin(SchemaOptions);

PaymentProcessors.set('toObject', {
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret._id;
    // Remove all payment processors
    keysOf(PAYMENT_PROCESSORS).forEach((p) => delete ret[p]);
  }
});

/**
 * Internal method to verify processor
 * @param {string} name - name of processor. Must be one of PAYMENT_PROCESSORS
 * @returns {Boolean}
 */
const _valid = function(name) {
  return keysOf(PAYMENT_PROCESSORS).includes(name);
};

// NB: Methods promisified to be compatible with billing queries

/**
 * Adds payment processor
 * USAGE: paymentProcessor.create({
 *   name: 'stripe',
 *   email: user.email
 *   token: 'jkl$#(@#d93029482304)'
 * });
 * @param {string} options.email - user email
 * @param {string} options.name - name of processor
 * @param {string} [options.token] - token for creating processor
 */
PaymentProcessors.statics.create = function(options) {
  let processor;
  const PaymentProcessors = this;
  const name = options.name;
  const email = options.email;

  return new Promise((resolve, reject) => {
    if (!email) {
      return reject(new errors.BadRequestError(emailErr));
    }

    if (!_valid(name)) {
      return reject(new errors.BadRequestError(
        `${name} PaymentProcessor is not supported / invalid name`)
      );
    }

    PaymentProcessors.find({ user: email }).then((doc) => {
      if (!doc) {
        processor = new PaymentProcessor({ user: email });
      } else {
        processor = doc;
      }

      if (processor[name]) {
        console.error(
          `${name} PaymentProcessor already exists ${doc[name]._id}`
        );
        return reject(new errors.BadRequestError(
          `Cannot create ${name} processor. Processor already exists`
        ));
      }

      const adapter = paymentProcessorAdapters[name]();

      adapter.register(options).then((processorData) => {
        processor[name] = processorData;

        if (!processor.default === undefined) {
          processor.default = name;
        }

        paymentProcessor.save().then(
          (result) => resolve(result),
          (err) => reject(new errors.InternalError(err))
        );
      }).catch((err) => reject(err));
    }).catch((err) => reject(err));
  });
};

/**
 * Returns selected payment processor
 * @param {string} name - processor name. Must be one of PAYMENT_PROCESSORS
 * @returns {Object|Null} - Returns selected adapter or default adapter
 */
PaymentProcessors.methods.adapter = function(name) {
  const processor = this;
  return new Promise((resolve, reject) => {
    if (name === 'default') {
      const defaultProcessor = processor.default;

      if (!defaultProcessor) {
        return resolve(new errors.BadRequestError(
          'No default payment processor'
        ));
      }
      const adapter = paymentProcessorAdapters[defaultProcessor](processor[defaultProcessor]); // jshint ignore:line
      return resolve(adapter);
    }

    if (_valid(name)) {
      const adapter = paymentProcessorAdapters[name](processor[name]);
      return resolve(adapter);
    }
    return reject(new errors.BadRequestError('Invalid processor name'));
  });
}

/**
 * Gets specified payment processor(s)
 * @param {string} options.email - user email
 * @param {string} options.name - name of payment processor or 'default'
 * @param {Boolean} options.all - return all payment processors
 * @returns {Array} array of processor objects
 */
PaymentProcessors.statics.get = function(options) {
  const PaymentProcessors = this;
  return new Promise((resolve, reject) => {

    const email = options.email;
    const name = options.name;
    const all = options.all;

    if (!email) {
      return reject(new errors.BadRequestError(emailErr));
    }

    PaymentProcessors.find({ user: email }).then((paymentProcessor) => {
      if (!paymentProcessor) {
        return reject(new errors.BadRequestError(
          'User has no payment processors')
        );
      }

      if (all) {
        let processors = [];
        keysOf(PAYMENT_PROCESSORS).forEach(function(key) {
          if (paymentProcessor[key]) {
            processors.push({ [key]: paymentProcessor[key] });
          }
        });
        return resolve(processors);
      }

      if (!name) {
        return reject(new errors.BadRequestError(
          'Must pass in name of processor')
        );
      }

      if (name === 'default') {
        const processor = paymentProcessor.default;
        return resolve(
          processor
            ? [{ [processor]: paymentProcessor[processor] }]
            : new errors.BadRequestError('No default payment processor')
        );
      }

      if (_valid(name)) {
        return resolve([{ [name]: paymentProcessor[name] }])
      }

      return reject(new errors.BadRequestError('Invalid payment processor'));
    });
  });
};

/**
 * Retrieves default payment processor data
 */
PaymentProcessors.methods.defaultPaymentProcessor = function() {
  const processor = this;
  return new Promise((resolve, reject) => {
    if (processor.default) {
      return resolve(processor[processor.default]);
    }
    return reject(new errors.BadRequestError('No default payment processor'));
  })
}

/**
 * Returns defaultPaymentMethod for processor
 * @param {string} options.name - processor name
 */
PaymentProcessors.methods.defaultPaymentMethod = function(options) {
  const processor = this;
  const name = options.name;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError('Invalid processor name'));
    }

    processor.adapter(name)
      .then((adapter) => adapter.defaultPaymentMethod())
      .catch((err) => reject(new errors.InternalError(
        'Error getting defaultPaymentMethod', err
      ));
  });
};

/**
 * Set default payment processor
 * @param {string} options.name - payment processor
 */
PaymentProcessor.methods.setDefaultPaymentProcessor = function(options) {
  const processor = this;
  const name = options.name;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError('Invalid processor name'));
    }

    if (!processor[name]) {
      return reject(new errors.BadRequestError(
        'Cannot set default payment processor to undefined payment processor'
      ));
    }

    processor.default = name;

    processor.save()
      .then((result) => resolve(result))
      .catch((err) => reject(new errors.InternalError(
        'Error saving processor: ', err
      ));
  });
};

/**
 * Delete payment processor via adapter, and then delete off PaymentProcessor
 * @param {string} options.name - processor name
 * @return {Object} - Result from Mongoose of status
 */
PaymentProcessors.methods.delete = function(options) {
  const processor = this;
  const name = options.name;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError('Invalid processor name'));
    }

    processor.adapter(name)
      .then((adapter) => adapter.delete())
      .then(() => mongooseQueries.deleteField(self, self._id, name))
      .then((result) => {
        if (processor.default === name) {
          delete processor.default;
          processor.save().then((result) => resolve(result));
        }
      })
      .catch((err) => {
        reject(new errors.InternalError('Error deleting processor', err));
      });
  });
};

/**
 * Adds payment method for specified payment processor
 * @param {string} options.name - processor name
 * @param {} options.data - data needed to add payment method; varies per
 *   payment processor
 */
PaymentProcessors.methods.addPaymentMethod = function(options) {
  const processor = this;
  const name = options.name;
  const data = options.data;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError('Invalid processor name'));
    }

    processor.adapter(name)
      .then((adapter) => adapter.addPaymentMethod(data))
      .then((modifiedProcessor) => modifiedProcessor.save())
      .then((result) => resolve(result))
      .catch((err) => {
        reject(new errors.InternalError('Error adding payment method: ', err));
      });
  });
};

PaymentProcessors.methods.billingDate = function(options) {
  const processor = this;
  const name = options.name;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError('Invalid processor name'));
    }
    return resolve(processor[options.name].billingDate);
  })
}

PaymentProcessors.methods.paymentMethods = function(options) {
  const processor = this;
  const name = options.name;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError('Invalid processor name'));
    }
    processor.adapter(name)
      .then((adapter) => resolve(adapter.paymentMethods()))
      .catch((err) => reject(new errors.InternalError(
        'Error retriving payment methods: ', err
      )));
  });
}

module.exports = function(connection) {
  return connection.model('PaymentProcessor', PaymentProcessor);
};
