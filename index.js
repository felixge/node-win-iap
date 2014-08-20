var Dom = require('xmldom').DOMParser;
var crypto = require('xml-crypto');
var request = require('request');
var q = require('q');
var moment = require('moment');

module.exports = Verifier;
function Verifier(options) {
  options = options || {};
  this._certCache = options.certCache || new MemoryCache();
  this._certURL = options.certURL || 'https://go.microsoft.com/fwlink/?LinkId=246509&cid=#{ID}';
  this._fetches = {};
}

Verifier.prototype.verify = function(receipt) {
  var self = this;
  var doc;
  var certId;
  return q
    .try(function parseXML() {
      var d = q.defer();
      function onError(err) {
        if (typeof err === 'string') {
          err = new Error(err);
        }
        err.verifyErr = 'badxml';
        d.reject(err);
      }
      doc = new Dom({
        ignoreWhiteSpace: true,
        errorHandler: {
          fatalError: onError,
          error: onError,
        }
      }).parseFromString(receipt);
      d.resolve();
      return d.promise;
    })
    .then(function useCachedCert() {
      certId = doc.firstChild.getAttribute('CertificateId');
      return self._certCache.get(certId);
    })
    .then(function useRemoteCert(cert) {
      if (cert) {
        // cert found in cache
        return cert;
      }
      if (self._fetches[certId]) {
        // already fetching this cert. let's avoid making another request
        return self._fetches[certId];
      }
      var d = q.defer();
      var url = self._certURL.replace('#{ID}', certId);
      request(url, function(err, res, body) {
        if (err) {
          err.verifyErr = 'badcertfetch';
          d.reject(err);
          return;
        }
        d.resolve(body);
      });
      self._fetches[certId] = d.promise;
      return self._fetches[certId];
    })
    .then(function checkSignature(cert) {
      q
      .try(function() {
        // cache set could be async
        return self._certCache.set(certId, cert);
      })
      .then(function() {
        delete self._fetches[certId];
      });
      var canonicalXML = stripWhitespace(doc.firstChild).toString();
      var sigXPath =  "//*//*[local-name(.)='Signature' and namespace-uri(.)='http://www.w3.org/2000/09/xmldsig#']";
      var signature = crypto.xpath(doc, sigXPath)[0];
      var sig = new crypto.SignedXml();
      sig.keyInfoProvider = new MemoryKeyInfo(cert);
      sig.loadSignature(signature.toString());
      if (sig.checkSignature(canonicalXML)) {
        var purchaseDate = doc.getElementsByTagName('ProductReceipt')[0].getAttribute('PurchaseDate');
        var expirationDate = doc.getElementsByTagName('ProductReceipt')[0].getAttribute('ExpirationDate');
        var options = {
          "startTimeMillis": moment(purchaseDate).valueOf(),
          "expiryTimeMillis": moment(expirationDate).valueOf()
        };
        return options;
      }
      var err = new Error('Bad Signature');
      err.verifyErr = 'badsignature';
      throw err;
    });
};

// stripWhitespace recursively removes all whitespace nodes that are children
// or siblings of the given node (including the node itself) and returns the
// the node itself.
function stripWhitespace(node) {
  var root = node;
  while (node) {
    // whitespace nodes have no tag name, but do have at least one sibling
    if (!node.tagName && (node.nextSibling || node.previousSibling)) {
      node.parentNode.removeChild(node);
    }
    stripWhitespace(node.firstChild);
    node = node.nextSibling;
  }
  return root;
}

// MemoryCache implements a naive in-memory key value cache. Entries do not
// expire. This is fine since the MS certs probably won't change all the time.
Verifier.MemoryCache = MemoryCache;
function MemoryCache() {
  this._cache = {};
}

MemoryCache.prototype.get = function(key) {
  return this._cache[key];
};

MemoryCache.prototype.set = function(key, val) {
  this._cache[key] = val;
};

// MemoryKeyInfo implements the key info interface used by xml-crypto.
// xml-crypto includes a file based implementation using readFileSync, but
// that's a terrible default.
function MemoryKeyInfo(cert) {
  this._cert = cert;
}

MemoryKeyInfo.prototype.getKeyInfo = function() {
  return '<X509Data></X509Data>';
};

MemoryKeyInfo.prototype.getKey = function() {
  return this._cert;
};
