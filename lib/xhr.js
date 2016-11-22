'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Basic XHR Library with some notions hardcoded in
 * of what the Layer server expects/returns.
 *
    layer.xhr({
      url: 'http://my.com/mydata',
      data: {hey: 'ho', there: 'folk'},
      method: 'GET',
      format: 'json',
      headers: {'fred': 'Joe'},
      timeout: 50000
    }, function(result) {
      if (!result.success) {
        errorHandler(result.data, result.headers, result.status);
      } else {
        successHandler(result.data, result.headers, result.xhr);
      }
    });
 *
 * @class layer.xhr
 * @private
 */

/**
 * Send a Request.
 *
 * @method  xhr
 * @param {Object} options
 * @param {string} options.url
 * @param {Mixed} [options.data=null]
 * @param {string} [options.format=''] - set to 'json' to get result parsed as json (in case there is no obvious Content-Type in the response)
 * @param {Object} [options.headers={}] - Name value pairs for  headers and their values
 * @param {number} [options.timeout=0] - When does the request expire/timeout in miliseconds.
 * @param {Function} callback
 * @param {Object} callback.result
 * @param {number} callback.result.status - http status code
 * @param {boolean} callback.result.success - true if it was a successful response
 * @param {XMLHttpRequest} callback.result.xhr - The XHR object used for the request
 * @param {Object} callback.result.data -  The parsed response body
 *
 * TODO:
 *
 * 1. Make this a subclass of Root and make it a singleton so it can inherit a proper event system
 * 2. Result should be a layer.ServerResponse instance
 * 3. Should only access link headers if requested; annoying having it throw errors every other time.
 */

// Don't set xhr to window.XMLHttpRequest as it will bypass jasmine's
// ajax library
var Xhr = typeof window === 'undefined' ? require('xhr2') : null;

function parseLinkHeaders(linkHeader) {
  if (!linkHeader) return {};

  // Split parts by comma
  var parts = linkHeader.split(',');
  var links = {};

  // Parse each part into a named link
  parts.forEach(function (part) {
    var section = part.split(';');
    if (section.length !== 2) return;
    var url = section[0].replace(/<(.*)>/, '$1').trim();
    var name = section[1].replace(/rel='?(.*)'?/, '$1').trim();
    links[name] = url;
  });

  return links;
}

module.exports = function (request, callback) {
  var req = Xhr ? new Xhr() : new XMLHttpRequest();
  var method = (request.method || 'GET').toUpperCase();

  var onload = function onload() {
    var headers = {
      'content-type': this.getResponseHeader('content-type')
    };

    var result = {
      status: this.status,
      success: this.status && this.status < 300,
      xhr: this
    };
    var isJSON = String(headers['content-type']).split(/;/)[0].match(/^application\/json/) || request.format === 'json';

    if (this.responseType === 'blob' || this.responseType === 'arraybuffer') {
      if (this.status === 0) {
        result.data = new Error('Connection Failed');
      } else {
        // Damnit, this.response is a function if using jasmine test framework.
        result.data = typeof this.response === 'function' ? this.responseText : this.response;
      }
    } else {
      if (isJSON && this.responseText) {
        try {
          result.data = JSON.parse(this.responseText);
        } catch (err) {
          result.data = {
            code: 999,
            message: 'Invalid JSON from server',
            response: this.responseText
          };
          result.status = 999;
        }
      } else {
        result.data = this.responseText;
      }

      module.exports.trigger({
        target: this,
        status: !this.responseText && !this.status ? 'connection:error' : 'connection:success'
      });

      if (!this.responseText && !this.status) {
        result.status = 408;
        result.data = {
          id: 'request_timeout',
          message: 'The server is not responding please try again in a few minutes',
          url: 'https://docs.layer.com/reference/client_api/errors',
          code: 0,
          status: 408,
          httpStatus: 408
        };
      } else if (this.status === 404 && _typeof(result.data) !== 'object') {
        result.data = {
          id: 'operation_not_found',
          message: 'Endpoint ' + (request.method || 'GET') + ' ' + request.url + ' does not exist',
          status: this.status,
          httpStatus: 404,
          code: 106,
          url: 'https://docs.layer.com/reference/client_api/errors'
        };
      } else if (typeof result.data === 'string' && this.status >= 400) {
        result.data = {
          id: 'unknown_error',
          message: result.data,
          status: this.status,
          httpStatus: this.status,
          code: 0,
          url: 'https://www.google.com/search?q=doh!'
        };
      }
    }

    if (request.headers && (request.headers.accept || '').match(/application\/vnd.layer\+json/)) {
      var links = this.getResponseHeader('link');
      if (links) result.Links = parseLinkHeaders(links);
    }
    result.xhr = this;

    if (callback) callback(result);
  };

  req.onload = onload;

  // UNTESTED!!!
  req.onerror = req.ontimeout = onload;

  // Replace all headers in arbitrary case with all lower case
  // for easy matching.
  var headersList = Object.keys(request.headers || {});
  var headers = {};
  headersList.forEach(function (header) {
    if (header.toLowerCase() === 'content-type') {
      headers['content-type'] = request.headers[header];
    } else {
      headers[header.toLowerCase()] = request.headers[header];
    }
  });
  request.headers = headers;

  var data = '';
  if (request.data) {
    if (typeof Blob !== 'undefined' && request.data instanceof Blob) {
      data = request.data;
    } else if (request.headers && (String(request.headers['content-type']).match(/^application\/json/) || String(request.headers['content-type']) === 'application/vnd.layer-patch+json')) {
      data = typeof request.data === 'string' ? request.data : JSON.stringify(request.data);
    } else if (request.data && _typeof(request.data) === 'object') {
      Object.keys(request.data).forEach(function (name) {
        if (data) data += '&';
        data += name + '=' + request.data[name];
      });
    } else {
      data = request.data; // Some form of raw string/data
    }
  }
  if (data) {
    if (method === 'GET') {
      request.url += '?' + data;
    }
  }

  req.open(method, request.url, true);
  if (request.timeout) req.timeout = request.timeout;
  if (request.withCredentials) req.withCredentials = true;
  if (request.responseType) req.responseType = request.responseType;

  if (request.headers) {
    Object.keys(request.headers).forEach(function (headerName) {
      return req.setRequestHeader(headerName, request.headers[headerName]);
    });
  }

  try {
    if (method === 'GET') {
      req.send();
    } else {
      req.send(data);
    }
  } catch (e) {
    // do nothing
  }
};

var listeners = [];
module.exports.addConnectionListener = function (func) {
  return listeners.push(func);
};

module.exports.trigger = function (evt) {
  listeners.forEach(function (func) {
    func(evt);
  });
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy94aHIuanMiXSwibmFtZXMiOlsiWGhyIiwid2luZG93IiwicmVxdWlyZSIsInBhcnNlTGlua0hlYWRlcnMiLCJsaW5rSGVhZGVyIiwicGFydHMiLCJzcGxpdCIsImxpbmtzIiwiZm9yRWFjaCIsInNlY3Rpb24iLCJwYXJ0IiwibGVuZ3RoIiwidXJsIiwicmVwbGFjZSIsInRyaW0iLCJuYW1lIiwibW9kdWxlIiwiZXhwb3J0cyIsInJlcXVlc3QiLCJjYWxsYmFjayIsInJlcSIsIlhNTEh0dHBSZXF1ZXN0IiwibWV0aG9kIiwidG9VcHBlckNhc2UiLCJvbmxvYWQiLCJoZWFkZXJzIiwiZ2V0UmVzcG9uc2VIZWFkZXIiLCJyZXN1bHQiLCJzdGF0dXMiLCJzdWNjZXNzIiwieGhyIiwiaXNKU09OIiwiU3RyaW5nIiwibWF0Y2giLCJmb3JtYXQiLCJyZXNwb25zZVR5cGUiLCJkYXRhIiwiRXJyb3IiLCJyZXNwb25zZSIsInJlc3BvbnNlVGV4dCIsIkpTT04iLCJwYXJzZSIsImVyciIsImNvZGUiLCJtZXNzYWdlIiwidHJpZ2dlciIsInRhcmdldCIsImlkIiwiaHR0cFN0YXR1cyIsImFjY2VwdCIsIkxpbmtzIiwib25lcnJvciIsIm9udGltZW91dCIsImhlYWRlcnNMaXN0IiwiT2JqZWN0Iiwia2V5cyIsImhlYWRlciIsInRvTG93ZXJDYXNlIiwiQmxvYiIsInN0cmluZ2lmeSIsIm9wZW4iLCJ0aW1lb3V0Iiwid2l0aENyZWRlbnRpYWxzIiwic2V0UmVxdWVzdEhlYWRlciIsImhlYWRlck5hbWUiLCJzZW5kIiwiZSIsImxpc3RlbmVycyIsImFkZENvbm5lY3Rpb25MaXN0ZW5lciIsInB1c2giLCJmdW5jIiwiZXZ0Il0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBdUJBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUF3QkE7QUFDQTtBQUNBLElBQU1BLE1BQU8sT0FBT0MsTUFBUCxLQUFrQixXQUFuQixHQUFrQ0MsUUFBUSxNQUFSLENBQWxDLEdBQW9ELElBQWhFOztBQUVBLFNBQVNDLGdCQUFULENBQTBCQyxVQUExQixFQUFzQztBQUNwQyxNQUFJLENBQUNBLFVBQUwsRUFBaUIsT0FBTyxFQUFQOztBQUVqQjtBQUNBLE1BQU1DLFFBQVFELFdBQVdFLEtBQVgsQ0FBaUIsR0FBakIsQ0FBZDtBQUNBLE1BQU1DLFFBQVEsRUFBZDs7QUFFQTtBQUNBRixRQUFNRyxPQUFOLENBQWMsZ0JBQVE7QUFDcEIsUUFBTUMsVUFBVUMsS0FBS0osS0FBTCxDQUFXLEdBQVgsQ0FBaEI7QUFDQSxRQUFJRyxRQUFRRSxNQUFSLEtBQW1CLENBQXZCLEVBQTBCO0FBQzFCLFFBQU1DLE1BQU1ILFFBQVEsQ0FBUixFQUFXSSxPQUFYLENBQW1CLFFBQW5CLEVBQTZCLElBQTdCLEVBQW1DQyxJQUFuQyxFQUFaO0FBQ0EsUUFBTUMsT0FBT04sUUFBUSxDQUFSLEVBQVdJLE9BQVgsQ0FBbUIsY0FBbkIsRUFBbUMsSUFBbkMsRUFBeUNDLElBQXpDLEVBQWI7QUFDQVAsVUFBTVEsSUFBTixJQUFjSCxHQUFkO0FBQ0QsR0FORDs7QUFRQSxTQUFPTCxLQUFQO0FBQ0Q7O0FBRURTLE9BQU9DLE9BQVAsR0FBaUIsVUFBQ0MsT0FBRCxFQUFVQyxRQUFWLEVBQXVCO0FBQ3RDLE1BQU1DLE1BQU1wQixNQUFNLElBQUlBLEdBQUosRUFBTixHQUFrQixJQUFJcUIsY0FBSixFQUE5QjtBQUNBLE1BQU1DLFNBQVMsQ0FBQ0osUUFBUUksTUFBUixJQUFrQixLQUFuQixFQUEwQkMsV0FBMUIsRUFBZjs7QUFFQSxNQUFNQyxTQUFTLFNBQVNBLE1BQVQsR0FBa0I7QUFDL0IsUUFBTUMsVUFBVTtBQUNkLHNCQUFnQixLQUFLQyxpQkFBTCxDQUF1QixjQUF2QjtBQURGLEtBQWhCOztBQUlBLFFBQU1DLFNBQVM7QUFDYkMsY0FBUSxLQUFLQSxNQURBO0FBRWJDLGVBQVMsS0FBS0QsTUFBTCxJQUFlLEtBQUtBLE1BQUwsR0FBYyxHQUZ6QjtBQUdiRSxXQUFLO0FBSFEsS0FBZjtBQUtBLFFBQU1DLFNBQVVDLE9BQU9QLFFBQVEsY0FBUixDQUFQLEVBQWdDbkIsS0FBaEMsQ0FBc0MsR0FBdEMsRUFBMkMsQ0FBM0MsRUFBOEMyQixLQUE5QyxDQUFvRCxvQkFBcEQsS0FDVGYsUUFBUWdCLE1BQVIsS0FBbUIsTUFEMUI7O0FBR0EsUUFBSSxLQUFLQyxZQUFMLEtBQXNCLE1BQXRCLElBQWdDLEtBQUtBLFlBQUwsS0FBc0IsYUFBMUQsRUFBeUU7QUFDdkUsVUFBSSxLQUFLUCxNQUFMLEtBQWdCLENBQXBCLEVBQXVCO0FBQ3JCRCxlQUFPUyxJQUFQLEdBQWMsSUFBSUMsS0FBSixDQUFVLG1CQUFWLENBQWQ7QUFDRCxPQUZELE1BRU87QUFDTDtBQUNBVixlQUFPUyxJQUFQLEdBQWMsT0FBTyxLQUFLRSxRQUFaLEtBQXlCLFVBQXpCLEdBQXNDLEtBQUtDLFlBQTNDLEdBQTBELEtBQUtELFFBQTdFO0FBQ0Q7QUFDRixLQVBELE1BT087QUFDTCxVQUFJUCxVQUFVLEtBQUtRLFlBQW5CLEVBQWlDO0FBQy9CLFlBQUk7QUFDRlosaUJBQU9TLElBQVAsR0FBY0ksS0FBS0MsS0FBTCxDQUFXLEtBQUtGLFlBQWhCLENBQWQ7QUFDRCxTQUZELENBRUUsT0FBT0csR0FBUCxFQUFZO0FBQ1pmLGlCQUFPUyxJQUFQLEdBQWM7QUFDWk8sa0JBQU0sR0FETTtBQUVaQyxxQkFBUywwQkFGRztBQUdaTixzQkFBVSxLQUFLQztBQUhILFdBQWQ7QUFLQVosaUJBQU9DLE1BQVAsR0FBZ0IsR0FBaEI7QUFDRDtBQUNGLE9BWEQsTUFXTztBQUNMRCxlQUFPUyxJQUFQLEdBQWMsS0FBS0csWUFBbkI7QUFDRDs7QUFHRHZCLGFBQU9DLE9BQVAsQ0FBZTRCLE9BQWYsQ0FBdUI7QUFDckJDLGdCQUFRLElBRGE7QUFFckJsQixnQkFBUSxDQUFDLEtBQUtXLFlBQU4sSUFBc0IsQ0FBQyxLQUFLWCxNQUE1QixHQUFxQyxrQkFBckMsR0FBMEQ7QUFGN0MsT0FBdkI7O0FBS0EsVUFBSSxDQUFDLEtBQUtXLFlBQU4sSUFBc0IsQ0FBQyxLQUFLWCxNQUFoQyxFQUF3QztBQUN0Q0QsZUFBT0MsTUFBUCxHQUFnQixHQUFoQjtBQUNBRCxlQUFPUyxJQUFQLEdBQWM7QUFDWlcsY0FBSSxpQkFEUTtBQUVaSCxtQkFBUyxnRUFGRztBQUdaaEMsZUFBSyxvREFITztBQUlaK0IsZ0JBQU0sQ0FKTTtBQUtaZixrQkFBUSxHQUxJO0FBTVpvQixzQkFBWTtBQU5BLFNBQWQ7QUFRRCxPQVZELE1BVU8sSUFBSSxLQUFLcEIsTUFBTCxLQUFnQixHQUFoQixJQUF1QixRQUFPRCxPQUFPUyxJQUFkLE1BQXVCLFFBQWxELEVBQTREO0FBQ2pFVCxlQUFPUyxJQUFQLEdBQWM7QUFDWlcsY0FBSSxxQkFEUTtBQUVaSCxtQkFBUyxlQUFlMUIsUUFBUUksTUFBUixJQUFrQixLQUFqQyxJQUEwQyxHQUExQyxHQUFnREosUUFBUU4sR0FBeEQsR0FBOEQsaUJBRjNEO0FBR1pnQixrQkFBUSxLQUFLQSxNQUhEO0FBSVpvQixzQkFBWSxHQUpBO0FBS1pMLGdCQUFNLEdBTE07QUFNWi9CLGVBQUs7QUFOTyxTQUFkO0FBUUQsT0FUTSxNQVNBLElBQUksT0FBT2UsT0FBT1MsSUFBZCxLQUF1QixRQUF2QixJQUFtQyxLQUFLUixNQUFMLElBQWUsR0FBdEQsRUFBMkQ7QUFDaEVELGVBQU9TLElBQVAsR0FBYztBQUNaVyxjQUFJLGVBRFE7QUFFWkgsbUJBQVNqQixPQUFPUyxJQUZKO0FBR1pSLGtCQUFRLEtBQUtBLE1BSEQ7QUFJWm9CLHNCQUFZLEtBQUtwQixNQUpMO0FBS1plLGdCQUFNLENBTE07QUFNWi9CLGVBQUs7QUFOTyxTQUFkO0FBUUQ7QUFDRjs7QUFFRCxRQUFJTSxRQUFRTyxPQUFSLElBQW1CLENBQUNQLFFBQVFPLE9BQVIsQ0FBZ0J3QixNQUFoQixJQUEwQixFQUEzQixFQUErQmhCLEtBQS9CLENBQXFDLDhCQUFyQyxDQUF2QixFQUE2RjtBQUMzRixVQUFNMUIsUUFBUSxLQUFLbUIsaUJBQUwsQ0FBdUIsTUFBdkIsQ0FBZDtBQUNBLFVBQUluQixLQUFKLEVBQVdvQixPQUFPdUIsS0FBUCxHQUFlL0MsaUJBQWlCSSxLQUFqQixDQUFmO0FBQ1o7QUFDRG9CLFdBQU9HLEdBQVAsR0FBYSxJQUFiOztBQUVBLFFBQUlYLFFBQUosRUFBY0EsU0FBU1EsTUFBVDtBQUNmLEdBaEZEOztBQWtGQVAsTUFBSUksTUFBSixHQUFhQSxNQUFiOztBQUVBO0FBQ0FKLE1BQUkrQixPQUFKLEdBQWMvQixJQUFJZ0MsU0FBSixHQUFnQjVCLE1BQTlCOztBQUVBO0FBQ0E7QUFDQSxNQUFNNkIsY0FBY0MsT0FBT0MsSUFBUCxDQUFZckMsUUFBUU8sT0FBUixJQUFtQixFQUEvQixDQUFwQjtBQUNBLE1BQU1BLFVBQVUsRUFBaEI7QUFDQTRCLGNBQVk3QyxPQUFaLENBQW9CLGtCQUFVO0FBQzVCLFFBQUlnRCxPQUFPQyxXQUFQLE9BQXlCLGNBQTdCLEVBQTZDO0FBQzNDaEMsY0FBUSxjQUFSLElBQTBCUCxRQUFRTyxPQUFSLENBQWdCK0IsTUFBaEIsQ0FBMUI7QUFDRCxLQUZELE1BRU87QUFDTC9CLGNBQVErQixPQUFPQyxXQUFQLEVBQVIsSUFBZ0N2QyxRQUFRTyxPQUFSLENBQWdCK0IsTUFBaEIsQ0FBaEM7QUFDRDtBQUNGLEdBTkQ7QUFPQXRDLFVBQVFPLE9BQVIsR0FBa0JBLE9BQWxCOztBQUVBLE1BQUlXLE9BQU8sRUFBWDtBQUNBLE1BQUlsQixRQUFRa0IsSUFBWixFQUFrQjtBQUNoQixRQUFJLE9BQU9zQixJQUFQLEtBQWdCLFdBQWhCLElBQStCeEMsUUFBUWtCLElBQVIsWUFBd0JzQixJQUEzRCxFQUFpRTtBQUMvRHRCLGFBQU9sQixRQUFRa0IsSUFBZjtBQUNELEtBRkQsTUFFTyxJQUFJbEIsUUFBUU8sT0FBUixLQUNQTyxPQUFPZCxRQUFRTyxPQUFSLENBQWdCLGNBQWhCLENBQVAsRUFBd0NRLEtBQXhDLENBQThDLG9CQUE5QyxLQUNBRCxPQUFPZCxRQUFRTyxPQUFSLENBQWdCLGNBQWhCLENBQVAsTUFBNEMsa0NBRnJDLENBQUosRUFHTDtBQUNBVyxhQUFPLE9BQU9sQixRQUFRa0IsSUFBZixLQUF3QixRQUF4QixHQUFtQ2xCLFFBQVFrQixJQUEzQyxHQUFrREksS0FBS21CLFNBQUwsQ0FBZXpDLFFBQVFrQixJQUF2QixDQUF6RDtBQUNELEtBTE0sTUFLQSxJQUFJbEIsUUFBUWtCLElBQVIsSUFBZ0IsUUFBT2xCLFFBQVFrQixJQUFmLE1BQXdCLFFBQTVDLEVBQXNEO0FBQzNEa0IsYUFBT0MsSUFBUCxDQUFZckMsUUFBUWtCLElBQXBCLEVBQTBCNUIsT0FBMUIsQ0FBa0MsZ0JBQVE7QUFDeEMsWUFBSTRCLElBQUosRUFBVUEsUUFBUSxHQUFSO0FBQ1ZBLGdCQUFRckIsT0FBTyxHQUFQLEdBQWFHLFFBQVFrQixJQUFSLENBQWFyQixJQUFiLENBQXJCO0FBQ0QsT0FIRDtBQUlELEtBTE0sTUFLQTtBQUNMcUIsYUFBT2xCLFFBQVFrQixJQUFmLENBREssQ0FDZ0I7QUFDdEI7QUFDRjtBQUNELE1BQUlBLElBQUosRUFBVTtBQUNSLFFBQUlkLFdBQVcsS0FBZixFQUFzQjtBQUNwQkosY0FBUU4sR0FBUixJQUFlLE1BQU13QixJQUFyQjtBQUNEO0FBQ0Y7O0FBRURoQixNQUFJd0MsSUFBSixDQUFTdEMsTUFBVCxFQUFpQkosUUFBUU4sR0FBekIsRUFBOEIsSUFBOUI7QUFDQSxNQUFJTSxRQUFRMkMsT0FBWixFQUFxQnpDLElBQUl5QyxPQUFKLEdBQWMzQyxRQUFRMkMsT0FBdEI7QUFDckIsTUFBSTNDLFFBQVE0QyxlQUFaLEVBQTZCMUMsSUFBSTBDLGVBQUosR0FBc0IsSUFBdEI7QUFDN0IsTUFBSTVDLFFBQVFpQixZQUFaLEVBQTBCZixJQUFJZSxZQUFKLEdBQW1CakIsUUFBUWlCLFlBQTNCOztBQUUxQixNQUFJakIsUUFBUU8sT0FBWixFQUFxQjtBQUNuQjZCLFdBQU9DLElBQVAsQ0FBWXJDLFFBQVFPLE9BQXBCLEVBQTZCakIsT0FBN0IsQ0FBcUM7QUFBQSxhQUFjWSxJQUFJMkMsZ0JBQUosQ0FBcUJDLFVBQXJCLEVBQWlDOUMsUUFBUU8sT0FBUixDQUFnQnVDLFVBQWhCLENBQWpDLENBQWQ7QUFBQSxLQUFyQztBQUNEOztBQUVELE1BQUk7QUFDRixRQUFJMUMsV0FBVyxLQUFmLEVBQXNCO0FBQ3BCRixVQUFJNkMsSUFBSjtBQUNELEtBRkQsTUFFTztBQUNMN0MsVUFBSTZDLElBQUosQ0FBUzdCLElBQVQ7QUFDRDtBQUNGLEdBTkQsQ0FNRSxPQUFPOEIsQ0FBUCxFQUFVO0FBQ1Y7QUFDRDtBQUNGLENBbEpEOztBQW9KQSxJQUFNQyxZQUFZLEVBQWxCO0FBQ0FuRCxPQUFPQyxPQUFQLENBQWVtRCxxQkFBZixHQUF1QztBQUFBLFNBQVFELFVBQVVFLElBQVYsQ0FBZUMsSUFBZixDQUFSO0FBQUEsQ0FBdkM7O0FBRUF0RCxPQUFPQyxPQUFQLENBQWU0QixPQUFmLEdBQXlCLFVBQUMwQixHQUFELEVBQVM7QUFDaENKLFlBQVUzRCxPQUFWLENBQWtCLGdCQUFRO0FBQ3hCOEQsU0FBS0MsR0FBTDtBQUNELEdBRkQ7QUFHRCxDQUpEIiwiZmlsZSI6Inhoci5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogQmFzaWMgWEhSIExpYnJhcnkgd2l0aCBzb21lIG5vdGlvbnMgaGFyZGNvZGVkIGluXG4gKiBvZiB3aGF0IHRoZSBMYXllciBzZXJ2ZXIgZXhwZWN0cy9yZXR1cm5zLlxuICpcbiAgICBsYXllci54aHIoe1xuICAgICAgdXJsOiAnaHR0cDovL215LmNvbS9teWRhdGEnLFxuICAgICAgZGF0YToge2hleTogJ2hvJywgdGhlcmU6ICdmb2xrJ30sXG4gICAgICBtZXRob2Q6ICdHRVQnLFxuICAgICAgZm9ybWF0OiAnanNvbicsXG4gICAgICBoZWFkZXJzOiB7J2ZyZWQnOiAnSm9lJ30sXG4gICAgICB0aW1lb3V0OiA1MDAwMFxuICAgIH0sIGZ1bmN0aW9uKHJlc3VsdCkge1xuICAgICAgaWYgKCFyZXN1bHQuc3VjY2Vzcykge1xuICAgICAgICBlcnJvckhhbmRsZXIocmVzdWx0LmRhdGEsIHJlc3VsdC5oZWFkZXJzLCByZXN1bHQuc3RhdHVzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN1Y2Nlc3NIYW5kbGVyKHJlc3VsdC5kYXRhLCByZXN1bHQuaGVhZGVycywgcmVzdWx0Lnhocik7XG4gICAgICB9XG4gICAgfSk7XG4gKlxuICogQGNsYXNzIGxheWVyLnhoclxuICogQHByaXZhdGVcbiAqL1xuXG4vKipcbiAqIFNlbmQgYSBSZXF1ZXN0LlxuICpcbiAqIEBtZXRob2QgIHhoclxuICogQHBhcmFtIHtPYmplY3R9IG9wdGlvbnNcbiAqIEBwYXJhbSB7c3RyaW5nfSBvcHRpb25zLnVybFxuICogQHBhcmFtIHtNaXhlZH0gW29wdGlvbnMuZGF0YT1udWxsXVxuICogQHBhcmFtIHtzdHJpbmd9IFtvcHRpb25zLmZvcm1hdD0nJ10gLSBzZXQgdG8gJ2pzb24nIHRvIGdldCByZXN1bHQgcGFyc2VkIGFzIGpzb24gKGluIGNhc2UgdGhlcmUgaXMgbm8gb2J2aW91cyBDb250ZW50LVR5cGUgaW4gdGhlIHJlc3BvbnNlKVxuICogQHBhcmFtIHtPYmplY3R9IFtvcHRpb25zLmhlYWRlcnM9e31dIC0gTmFtZSB2YWx1ZSBwYWlycyBmb3IgIGhlYWRlcnMgYW5kIHRoZWlyIHZhbHVlc1xuICogQHBhcmFtIHtudW1iZXJ9IFtvcHRpb25zLnRpbWVvdXQ9MF0gLSBXaGVuIGRvZXMgdGhlIHJlcXVlc3QgZXhwaXJlL3RpbWVvdXQgaW4gbWlsaXNlY29uZHMuXG4gKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICogQHBhcmFtIHtPYmplY3R9IGNhbGxiYWNrLnJlc3VsdFxuICogQHBhcmFtIHtudW1iZXJ9IGNhbGxiYWNrLnJlc3VsdC5zdGF0dXMgLSBodHRwIHN0YXR1cyBjb2RlXG4gKiBAcGFyYW0ge2Jvb2xlYW59IGNhbGxiYWNrLnJlc3VsdC5zdWNjZXNzIC0gdHJ1ZSBpZiBpdCB3YXMgYSBzdWNjZXNzZnVsIHJlc3BvbnNlXG4gKiBAcGFyYW0ge1hNTEh0dHBSZXF1ZXN0fSBjYWxsYmFjay5yZXN1bHQueGhyIC0gVGhlIFhIUiBvYmplY3QgdXNlZCBmb3IgdGhlIHJlcXVlc3RcbiAqIEBwYXJhbSB7T2JqZWN0fSBjYWxsYmFjay5yZXN1bHQuZGF0YSAtICBUaGUgcGFyc2VkIHJlc3BvbnNlIGJvZHlcbiAqXG4gKiBUT0RPOlxuICpcbiAqIDEuIE1ha2UgdGhpcyBhIHN1YmNsYXNzIG9mIFJvb3QgYW5kIG1ha2UgaXQgYSBzaW5nbGV0b24gc28gaXQgY2FuIGluaGVyaXQgYSBwcm9wZXIgZXZlbnQgc3lzdGVtXG4gKiAyLiBSZXN1bHQgc2hvdWxkIGJlIGEgbGF5ZXIuU2VydmVyUmVzcG9uc2UgaW5zdGFuY2VcbiAqIDMuIFNob3VsZCBvbmx5IGFjY2VzcyBsaW5rIGhlYWRlcnMgaWYgcmVxdWVzdGVkOyBhbm5veWluZyBoYXZpbmcgaXQgdGhyb3cgZXJyb3JzIGV2ZXJ5IG90aGVyIHRpbWUuXG4gKi9cblxuLy8gRG9uJ3Qgc2V0IHhociB0byB3aW5kb3cuWE1MSHR0cFJlcXVlc3QgYXMgaXQgd2lsbCBieXBhc3MgamFzbWluZSdzXG4vLyBhamF4IGxpYnJhcnlcbmNvbnN0IFhociA9ICh0eXBlb2Ygd2luZG93ID09PSAndW5kZWZpbmVkJykgPyByZXF1aXJlKCd4aHIyJykgOiBudWxsO1xuXG5mdW5jdGlvbiBwYXJzZUxpbmtIZWFkZXJzKGxpbmtIZWFkZXIpIHtcbiAgaWYgKCFsaW5rSGVhZGVyKSByZXR1cm4ge307XG5cbiAgLy8gU3BsaXQgcGFydHMgYnkgY29tbWFcbiAgY29uc3QgcGFydHMgPSBsaW5rSGVhZGVyLnNwbGl0KCcsJyk7XG4gIGNvbnN0IGxpbmtzID0ge307XG5cbiAgLy8gUGFyc2UgZWFjaCBwYXJ0IGludG8gYSBuYW1lZCBsaW5rXG4gIHBhcnRzLmZvckVhY2gocGFydCA9PiB7XG4gICAgY29uc3Qgc2VjdGlvbiA9IHBhcnQuc3BsaXQoJzsnKTtcbiAgICBpZiAoc2VjdGlvbi5sZW5ndGggIT09IDIpIHJldHVybjtcbiAgICBjb25zdCB1cmwgPSBzZWN0aW9uWzBdLnJlcGxhY2UoLzwoLiopPi8sICckMScpLnRyaW0oKTtcbiAgICBjb25zdCBuYW1lID0gc2VjdGlvblsxXS5yZXBsYWNlKC9yZWw9Jz8oLiopJz8vLCAnJDEnKS50cmltKCk7XG4gICAgbGlua3NbbmFtZV0gPSB1cmw7XG4gIH0pO1xuXG4gIHJldHVybiBsaW5rcztcbn1cblxubW9kdWxlLmV4cG9ydHMgPSAocmVxdWVzdCwgY2FsbGJhY2spID0+IHtcbiAgY29uc3QgcmVxID0gWGhyID8gbmV3IFhocigpIDogbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG4gIGNvbnN0IG1ldGhvZCA9IChyZXF1ZXN0Lm1ldGhvZCB8fCAnR0VUJykudG9VcHBlckNhc2UoKTtcblxuICBjb25zdCBvbmxvYWQgPSBmdW5jdGlvbiBvbmxvYWQoKSB7XG4gICAgY29uc3QgaGVhZGVycyA9IHtcbiAgICAgICdjb250ZW50LXR5cGUnOiB0aGlzLmdldFJlc3BvbnNlSGVhZGVyKCdjb250ZW50LXR5cGUnKSxcbiAgICB9O1xuXG4gICAgY29uc3QgcmVzdWx0ID0ge1xuICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgIHN1Y2Nlc3M6IHRoaXMuc3RhdHVzICYmIHRoaXMuc3RhdHVzIDwgMzAwLFxuICAgICAgeGhyOiB0aGlzLFxuICAgIH07XG4gICAgY29uc3QgaXNKU09OID0gKFN0cmluZyhoZWFkZXJzWydjb250ZW50LXR5cGUnXSkuc3BsaXQoLzsvKVswXS5tYXRjaCgvXmFwcGxpY2F0aW9uXFwvanNvbi8pIHx8XG4gICAgICAgICAgIHJlcXVlc3QuZm9ybWF0ID09PSAnanNvbicpO1xuXG4gICAgaWYgKHRoaXMucmVzcG9uc2VUeXBlID09PSAnYmxvYicgfHwgdGhpcy5yZXNwb25zZVR5cGUgPT09ICdhcnJheWJ1ZmZlcicpIHtcbiAgICAgIGlmICh0aGlzLnN0YXR1cyA9PT0gMCkge1xuICAgICAgICByZXN1bHQuZGF0YSA9IG5ldyBFcnJvcignQ29ubmVjdGlvbiBGYWlsZWQnKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIERhbW5pdCwgdGhpcy5yZXNwb25zZSBpcyBhIGZ1bmN0aW9uIGlmIHVzaW5nIGphc21pbmUgdGVzdCBmcmFtZXdvcmsuXG4gICAgICAgIHJlc3VsdC5kYXRhID0gdHlwZW9mIHRoaXMucmVzcG9uc2UgPT09ICdmdW5jdGlvbicgPyB0aGlzLnJlc3BvbnNlVGV4dCA6IHRoaXMucmVzcG9uc2U7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIGlmIChpc0pTT04gJiYgdGhpcy5yZXNwb25zZVRleHQpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICByZXN1bHQuZGF0YSA9IEpTT04ucGFyc2UodGhpcy5yZXNwb25zZVRleHQpO1xuICAgICAgICB9IGNhdGNoIChlcnIpIHtcbiAgICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICAgIGNvZGU6IDk5OSxcbiAgICAgICAgICAgIG1lc3NhZ2U6ICdJbnZhbGlkIEpTT04gZnJvbSBzZXJ2ZXInLFxuICAgICAgICAgICAgcmVzcG9uc2U6IHRoaXMucmVzcG9uc2VUZXh0LFxuICAgICAgICAgIH07XG4gICAgICAgICAgcmVzdWx0LnN0YXR1cyA9IDk5OTtcbiAgICAgICAgfVxuICAgICAgfSBlbHNlIHtcbiAgICAgICAgcmVzdWx0LmRhdGEgPSB0aGlzLnJlc3BvbnNlVGV4dDtcbiAgICAgIH1cblxuXG4gICAgICBtb2R1bGUuZXhwb3J0cy50cmlnZ2VyKHtcbiAgICAgICAgdGFyZ2V0OiB0aGlzLFxuICAgICAgICBzdGF0dXM6ICF0aGlzLnJlc3BvbnNlVGV4dCAmJiAhdGhpcy5zdGF0dXMgPyAnY29ubmVjdGlvbjplcnJvcicgOiAnY29ubmVjdGlvbjpzdWNjZXNzJyxcbiAgICAgIH0pO1xuXG4gICAgICBpZiAoIXRoaXMucmVzcG9uc2VUZXh0ICYmICF0aGlzLnN0YXR1cykge1xuICAgICAgICByZXN1bHQuc3RhdHVzID0gNDA4O1xuICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICBpZDogJ3JlcXVlc3RfdGltZW91dCcsXG4gICAgICAgICAgbWVzc2FnZTogJ1RoZSBzZXJ2ZXIgaXMgbm90IHJlc3BvbmRpbmcgcGxlYXNlIHRyeSBhZ2FpbiBpbiBhIGZldyBtaW51dGVzJyxcbiAgICAgICAgICB1cmw6ICdodHRwczovL2RvY3MubGF5ZXIuY29tL3JlZmVyZW5jZS9jbGllbnRfYXBpL2Vycm9ycycsXG4gICAgICAgICAgY29kZTogMCxcbiAgICAgICAgICBzdGF0dXM6IDQwOCxcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDgsXG4gICAgICAgIH07XG4gICAgICB9IGVsc2UgaWYgKHRoaXMuc3RhdHVzID09PSA0MDQgJiYgdHlwZW9mIHJlc3VsdC5kYXRhICE9PSAnb2JqZWN0Jykge1xuICAgICAgICByZXN1bHQuZGF0YSA9IHtcbiAgICAgICAgICBpZDogJ29wZXJhdGlvbl9ub3RfZm91bmQnLFxuICAgICAgICAgIG1lc3NhZ2U6ICdFbmRwb2ludCAnICsgKHJlcXVlc3QubWV0aG9kIHx8ICdHRVQnKSArICcgJyArIHJlcXVlc3QudXJsICsgJyBkb2VzIG5vdCBleGlzdCcsXG4gICAgICAgICAgc3RhdHVzOiB0aGlzLnN0YXR1cyxcbiAgICAgICAgICBodHRwU3RhdHVzOiA0MDQsXG4gICAgICAgICAgY29kZTogMTA2LFxuICAgICAgICAgIHVybDogJ2h0dHBzOi8vZG9jcy5sYXllci5jb20vcmVmZXJlbmNlL2NsaWVudF9hcGkvZXJyb3JzJyxcbiAgICAgICAgfTtcbiAgICAgIH0gZWxzZSBpZiAodHlwZW9mIHJlc3VsdC5kYXRhID09PSAnc3RyaW5nJyAmJiB0aGlzLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgcmVzdWx0LmRhdGEgPSB7XG4gICAgICAgICAgaWQ6ICd1bmtub3duX2Vycm9yJyxcbiAgICAgICAgICBtZXNzYWdlOiByZXN1bHQuZGF0YSxcbiAgICAgICAgICBzdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgICAgIGh0dHBTdGF0dXM6IHRoaXMuc3RhdHVzLFxuICAgICAgICAgIGNvZGU6IDAsXG4gICAgICAgICAgdXJsOiAnaHR0cHM6Ly93d3cuZ29vZ2xlLmNvbS9zZWFyY2g/cT1kb2ghJyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICBpZiAocmVxdWVzdC5oZWFkZXJzICYmIChyZXF1ZXN0LmhlYWRlcnMuYWNjZXB0IHx8ICcnKS5tYXRjaCgvYXBwbGljYXRpb25cXC92bmQubGF5ZXJcXCtqc29uLykpIHtcbiAgICAgIGNvbnN0IGxpbmtzID0gdGhpcy5nZXRSZXNwb25zZUhlYWRlcignbGluaycpO1xuICAgICAgaWYgKGxpbmtzKSByZXN1bHQuTGlua3MgPSBwYXJzZUxpbmtIZWFkZXJzKGxpbmtzKTtcbiAgICB9XG4gICAgcmVzdWx0LnhociA9IHRoaXM7XG5cbiAgICBpZiAoY2FsbGJhY2spIGNhbGxiYWNrKHJlc3VsdCk7XG4gIH07XG5cbiAgcmVxLm9ubG9hZCA9IG9ubG9hZDtcblxuICAvLyBVTlRFU1RFRCEhIVxuICByZXEub25lcnJvciA9IHJlcS5vbnRpbWVvdXQgPSBvbmxvYWQ7XG5cbiAgLy8gUmVwbGFjZSBhbGwgaGVhZGVycyBpbiBhcmJpdHJhcnkgY2FzZSB3aXRoIGFsbCBsb3dlciBjYXNlXG4gIC8vIGZvciBlYXN5IG1hdGNoaW5nLlxuICBjb25zdCBoZWFkZXJzTGlzdCA9IE9iamVjdC5rZXlzKHJlcXVlc3QuaGVhZGVycyB8fCB7fSk7XG4gIGNvbnN0IGhlYWRlcnMgPSB7fTtcbiAgaGVhZGVyc0xpc3QuZm9yRWFjaChoZWFkZXIgPT4ge1xuICAgIGlmIChoZWFkZXIudG9Mb3dlckNhc2UoKSA9PT0gJ2NvbnRlbnQtdHlwZScpIHtcbiAgICAgIGhlYWRlcnNbJ2NvbnRlbnQtdHlwZSddID0gcmVxdWVzdC5oZWFkZXJzW2hlYWRlcl07XG4gICAgfSBlbHNlIHtcbiAgICAgIGhlYWRlcnNbaGVhZGVyLnRvTG93ZXJDYXNlKCldID0gcmVxdWVzdC5oZWFkZXJzW2hlYWRlcl07XG4gICAgfVxuICB9KTtcbiAgcmVxdWVzdC5oZWFkZXJzID0gaGVhZGVycztcblxuICBsZXQgZGF0YSA9ICcnO1xuICBpZiAocmVxdWVzdC5kYXRhKSB7XG4gICAgaWYgKHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJyAmJiByZXF1ZXN0LmRhdGEgaW5zdGFuY2VvZiBCbG9iKSB7XG4gICAgICBkYXRhID0gcmVxdWVzdC5kYXRhO1xuICAgIH0gZWxzZSBpZiAocmVxdWVzdC5oZWFkZXJzICYmIChcbiAgICAgICAgU3RyaW5nKHJlcXVlc3QuaGVhZGVyc1snY29udGVudC10eXBlJ10pLm1hdGNoKC9eYXBwbGljYXRpb25cXC9qc29uLykgfHxcbiAgICAgICAgU3RyaW5nKHJlcXVlc3QuaGVhZGVyc1snY29udGVudC10eXBlJ10pID09PSAnYXBwbGljYXRpb24vdm5kLmxheWVyLXBhdGNoK2pzb24nKVxuICAgICkge1xuICAgICAgZGF0YSA9IHR5cGVvZiByZXF1ZXN0LmRhdGEgPT09ICdzdHJpbmcnID8gcmVxdWVzdC5kYXRhIDogSlNPTi5zdHJpbmdpZnkocmVxdWVzdC5kYXRhKTtcbiAgICB9IGVsc2UgaWYgKHJlcXVlc3QuZGF0YSAmJiB0eXBlb2YgcmVxdWVzdC5kYXRhID09PSAnb2JqZWN0Jykge1xuICAgICAgT2JqZWN0LmtleXMocmVxdWVzdC5kYXRhKS5mb3JFYWNoKG5hbWUgPT4ge1xuICAgICAgICBpZiAoZGF0YSkgZGF0YSArPSAnJic7XG4gICAgICAgIGRhdGEgKz0gbmFtZSArICc9JyArIHJlcXVlc3QuZGF0YVtuYW1lXTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBkYXRhID0gcmVxdWVzdC5kYXRhOyAvLyBTb21lIGZvcm0gb2YgcmF3IHN0cmluZy9kYXRhXG4gICAgfVxuICB9XG4gIGlmIChkYXRhKSB7XG4gICAgaWYgKG1ldGhvZCA9PT0gJ0dFVCcpIHtcbiAgICAgIHJlcXVlc3QudXJsICs9ICc/JyArIGRhdGE7XG4gICAgfVxuICB9XG5cbiAgcmVxLm9wZW4obWV0aG9kLCByZXF1ZXN0LnVybCwgdHJ1ZSk7XG4gIGlmIChyZXF1ZXN0LnRpbWVvdXQpIHJlcS50aW1lb3V0ID0gcmVxdWVzdC50aW1lb3V0O1xuICBpZiAocmVxdWVzdC53aXRoQ3JlZGVudGlhbHMpIHJlcS53aXRoQ3JlZGVudGlhbHMgPSB0cnVlO1xuICBpZiAocmVxdWVzdC5yZXNwb25zZVR5cGUpIHJlcS5yZXNwb25zZVR5cGUgPSByZXF1ZXN0LnJlc3BvbnNlVHlwZTtcblxuICBpZiAocmVxdWVzdC5oZWFkZXJzKSB7XG4gICAgT2JqZWN0LmtleXMocmVxdWVzdC5oZWFkZXJzKS5mb3JFYWNoKGhlYWRlck5hbWUgPT4gcmVxLnNldFJlcXVlc3RIZWFkZXIoaGVhZGVyTmFtZSwgcmVxdWVzdC5oZWFkZXJzW2hlYWRlck5hbWVdKSk7XG4gIH1cblxuICB0cnkge1xuICAgIGlmIChtZXRob2QgPT09ICdHRVQnKSB7XG4gICAgICByZXEuc2VuZCgpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXEuc2VuZChkYXRhKTtcbiAgICB9XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBkbyBub3RoaW5nXG4gIH1cbn07XG5cbmNvbnN0IGxpc3RlbmVycyA9IFtdO1xubW9kdWxlLmV4cG9ydHMuYWRkQ29ubmVjdGlvbkxpc3RlbmVyID0gZnVuYyA9PiBsaXN0ZW5lcnMucHVzaChmdW5jKTtcblxubW9kdWxlLmV4cG9ydHMudHJpZ2dlciA9IChldnQpID0+IHtcbiAgbGlzdGVuZXJzLmZvckVhY2goZnVuYyA9PiB7XG4gICAgZnVuYyhldnQpO1xuICB9KTtcbn07XG4iXX0=
