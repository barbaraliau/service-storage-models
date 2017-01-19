'use strict';

const mongoose = require('mongoose');
const SchemaOptions = require('../options');
const constants = require('../constants');
const PAYMENT_PROCESSORS = constants.PAYMENT_PROCESSORS;
const paymentProcessorAdapters = require('./payment-processor-adapters');
const errors = require('storj-service-error-types');
const { keysOf, queries } = require('../utils');
const emailErr = 'Must pass in valid email';
const nameErr = 'Invalid processor name';

const PaymentProcessors = new mongoose.Schema({
  user: {
    type: String,
    unique: true
  },
  [PAYMENT_PROCESSORS.STRIPE]: {
    type: mongoose.Schema.Types.Mixed,
    get: parseData,
    set: serializeData
  },
  [PAYMENT_PROCESSORS.BRAINTREE]: {
    type: mongoose.Schema.Types.Mixed,
    get: parseData,
    set: serializeData
  },
  [PAYMENT_PROCESSORS.HEROKU]: {
    type: mongoose.Schema.Types.Mixed,
    get: parseData,
    set: serializeData
  },
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

function parseData(val, schematype) {
  if (val) {
    return val[0];
  }
  return val
}

function serializeData(val) {
  return [val];
}

PaymentProcessors.plugin(SchemaOptions);

PaymentProcessors.set('toObject', {
  virtuals: true,
  transform: (doc, ret) => {
    delete ret.__v;
    delete ret._id;
    // Remove all payment processors
    keysOf(PAYMENT_PROCESSORS).forEach((p) => delete ret[p]);
  }
});

// NB: Methods promisified to be compatible with billing queries

/**
 * Internal method to verify processor
 * @param {string} name - processor. Must be one of PAYMENT_PROCESSORS
 * @returns {Boolean}
 */
function _valid(name) {
  return keysOf(PAYMENT_PROCESSORS).includes(name);
};

/**
 * Retrieves default payment processor data
 */
PaymentProcessors.virtual('defaultPaymentProcessor')
  .get(function() {
    if (this.default) {
      return this[this.default];
    }
    return null;
  });

/**
 * Adds payment processor
 * USAGE: paymentProcessor.create({
 *   name: 'stripe',
 *   user: user,
 *   token: 'jkl$#(@#d93029482304)'
 * });
 * @param {string} email - user email
 * @param {string} name - processor
 * @param {string} token - token for creating processor
 */
PaymentProcessors.statics.create = function(email, name, token) {
  const PaymentProcessors = this;

  return new Promise((resolve, reject) => {
    let processor;

    if (!email) {
      return reject(new errors.BadRequestError(emailErr));
    }

    if (!_valid(name)) {
      return reject(new errors.BadRequestError(
        `${name} payment processor is not supported / invalid name`)
      );
    }

    PaymentProcessors
      .findOne({ user: email })
      .then((doc) => {
        if (doc) {
          processor = doc;
        } else {
          processor = new PaymentProcessors({ user: email });
        }

        if (processor[name]) {
          return reject(new errors.BadRequestError(
            `Cannot create ${name} processor. Processor already exists`
          ));
        }

        const adapter = paymentProcessorAdapters[name]();

        adapter.register(options).then((processorData) => {

          processor[name] = processorData;

          if (!processor.default) {
            processor.default = name;
          }

          processor.save().then(
            (result) => resolve(result),
            (err) => reject(err)
          );
        }, (err) => reject(err));
      })
      .catch((err) => reject(
        new errors.InternalError('Error creating payment processor: ', err )
      ));
  });
};

/**
 * Returns entire Payment Processor object
 * @param {Object} email - user email
 * @returns {Promise<Object>} - PaymentProcessor
 */
PaymentProcessor.statics.lookup = function(email) {
  const PaymentProcessors = this;
  return new Promise((resolve, reject) => {
    if (!email) {
      return reject(new errors.BadRequestError(emailErr));
    }

    PaymentProcessors
      .findOne({ user: email })
      .then((processors) => {
        if (!processors) {
          return reject(new errors.BadRequestError('User has no processors'));
        }
        return resolve(processors);
      })
      .catch((err) => {
        if (err) {
          return reject(new errors.InternalError(err));
        }
      });
  });
}

/**
 * Gets specified payment processor(s)
 * @param {string} name - name of payment processor || 'default'
 * @returns {object|null}} processor object
 */
PaymentProcessors.methods.get = function(name) {
  if (name === 'default') {
    return this[this.default]
  }

  if (_valid(name)) {
    return this[name];
  }

  return null;
};

/**
 * Gets all payment processors
 * @returns {Array} array of processors
 */
PaymentProcessor.methods.getAll = function() {
  let processors = [];
  keysOf(PAYMENT_PROCESSORS).forEach(function(key) {
    if (this[key]) {
      processors.push({ [key]: paymentProcessor[key] });
    }
  });
  return processors;
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
      const adapter =
        paymentProcessorAdapters[defaultProcessor](processor[defaultProcessor]);
      return resolve(adapter);
    }

    if (_valid(name)) {
      const adapter = paymentProcessorAdapters[name](processor[name]);
      return resolve(adapter);
    }

    return reject(new errors.BadRequestError(nameErr));
  });
};

/**
 * Returns defaultPaymentMethod for processor
 * @param {string} name - processor name
 */
PaymentProcessors.methods.defaultPaymentMethod = function(name) {
  const processor = this;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError(nameErr));
    }

    processor.adapter(name)
      .then((adapter) => resolve(adapter.defaultPaymentMethod()))
      .catch((err) => reject(new errors.InternalError(
        'Error getting defaultPaymentMethod', err
      )));
  });
};

/**
 * Set default payment processor
 * @param {string} name - payment processor
 */
PaymentProcessors.methods.setDefaultPaymentProcessor = function(name) {
  const processor = this;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError(nameErr));
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
      )));
  });
};

/**
 * Delete payment processor via adapter, and then delete off PaymentProcessor
 * @param {string} name - processor name
 * @return {Object} - Result from Mongoose of status
 */
PaymentProcessors.methods.delete = function(name) {
  const processor = this;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError(nameErr));
    }

    processor.adapter(name)
      .then((adapter) => adapter.delete())
      .then(() => queries.deleteField(processor, processor._id, name))
      .then(() => {
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
 * @param {string} name - processor name
 * @param {} data - data needed to add payment method; varies per
 */
PaymentProcessors.methods.addPaymentMethod = function(name, data) {
  const processor = this;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError(nameErr));
    }

    if (!data) {
      return reject(new errors.BadRequestError('No data passed in'));
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

/**
 * Get billing date
 * @param {string} name - name of specific processor
 * @returns {Promise<Date>} - billing date
 */
PaymentProcessors.methods.billingDate = function(name) {
  const processor = this;

  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError(nameErr));
    }

    if (name === 'default') {
      return (processor.default
        ? resolve(processor[processor.default].billingDate))
        : reject(new errors.BadRequestError('No default processor'))
    }

    if (processor[name]) {
      return resolve(processor[name].billingDate);
    }

    return reject(new errors.BadRequestError('Processor does not exist'))
  });
};

/**
 * Gets paymentMethods for specified processor
 * @param {string} name - name of specific processor
 */
PaymentProcessors.methods.paymentMethods = function(name) {
  const processor = this;
  let lookUp;
  return new Promise((resolve, reject) => {
    if (!name || !_valid(name)) {
      return reject(new errors.BadRequestError(nameErr));
    }

    if (name === 'default' && processor.default) {
      lookUp = processor.default;
    } else {
      return reject(new errors.BadRequestError('No default processor'));
    }

    processor.adapter(lookUp)
      .then((adapter) => resolve(adapter.paymentMethods()))
      .catch((err) => reject(new errors.InternalError(
        'Error retriving payment methods: ', err
      )));
  });
};

module.exports = function(connection) {
  return connection.model('PaymentProcessors', PaymentProcessors);
};
