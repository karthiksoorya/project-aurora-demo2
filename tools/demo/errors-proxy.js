// Lazily resolves the API's DomainError (avoids a load-order cycle with the shim).
module.exports = {
  get DomainError() {
    return require('../../apps/api/dist/common/errors').DomainError;
  },
};
