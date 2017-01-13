module.exports.validateEmail = function (email) {
  const tester = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@(([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/; // jshint ignore:line

  if (!tester.test(email)) {
    return false;
  }
  return true;
};

module.exports.keysOf = function(obj) {
  return Object.keys(obj).map((key) => obj[key]);
};

module.exports.queries = {
  create(model, body) {
    return new Promise((resolve, reject) => {
      model(body).save()
        .then((result) => resolve(result))
        .catch((err) => reject(err))
    });
  },

  query(model, query) {
    return new Promise((resolve, reject) => {
      model.find(query)
      .then((result) => resolve(result))
      .catch((err) => reject(err))
    });
  },

  details(model, id) {
    return new Promise((resolve, reject) => {
      model.findOne({ _id: id })
        .then((result) => resolve(result))
        .catch((err) => reject(err))
    });
  },

  delete(model, id) {
    return new Promise((resolve, reject) => {
      model.findByIdAndRemove(id)
        .then((result) => resolve(result))
        .catch((err) => reject(err))
    });
  },

  deleteField(model, id, field) {
    return new Promise((resolve, reject) => {
      model.findOne({ _id: id }).then((doc) => {
        delete doc[field];
        model.save()
          .then((result) => resolve(result))
          .catch((err) => reject(err));
      });
    });
  },

  update(model, query, body) {
    return new Promise((resolve, reject) => {
      model.findOneAndUpdate(query, body, {}, (err, result) => {
        if(err) return reject(err)
        return resolve(result)
      });
    });
  }
};
