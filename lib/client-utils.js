'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/**
 * Utility methods
 *
 * @class layer.ClientUtils
 */

var LayerParser = require('layer-patch');
var uuid = require('uuid');
var atob = typeof window === 'undefined' ? require('atob') : window.atob;

/* istanbul ignore next */
var LocalFileReader = typeof window === 'undefined' ? require('filereader') : window.FileReader;

/**
 * Generate a random UUID
 *
 * @method
 * @return {string}
 */
exports.generateUUID = uuid.v4;

/**
 * Returns the 'type' portion of a Layer ID.
 *
 *         switch(Utils.typeFromID(id)) {
 *             case 'conversations':
 *                 ...
 *             case 'message':
 *                 ...
 *             case: 'queries':
 *                 ...
 *         }
 *
 * Does not currently handle Layer App IDs.
 *
 * @method
 * @param  {string} id
 * @return {string}
 */
exports.typeFromID = function (id) {
  var matches = id.match(/layer:\/\/\/(.*?)\//);
  return matches ? matches[1] : '';
};

exports.isEmpty = function (obj) {
  return Object.prototype.toString.apply(obj) === '[object Object]' && Object.keys(obj).length === 0;
};

/**
 * Simplified sort method.
 *
 * Provides a function to return the value to compare rather than do the comparison.
 *
 *      sortBy([{v: 3}, {v: 1}, v: 33}], function(value) {
 *          return value.v;
 *      }, false);
 *
 * @method
 * @param  {Mixed[]}   inArray      Array to sort
 * @param  {Function} fn            Function that will return a value to compare
 * @param  {Function} fn.value      Current value from inArray we are comparing, and from which a value should be extracted
 * @param  {boolean}  [reverse=false] Sort ascending (false) or descending (true)
 */
exports.sortBy = function (inArray, fn, reverse) {
  reverse = reverse ? -1 : 1;
  return inArray.sort(function (valueA, valueB) {
    var aa = fn(valueA);
    var bb = fn(valueB);
    if (aa === undefined && bb === undefined) return 0;
    if (aa === undefined && bb !== undefined) return 1;
    if (aa !== undefined && bb === undefined) return -1;
    if (aa > bb) return 1 * reverse;
    if (aa < bb) return -1 * reverse;
    return 0;
  });
};

/**
 * Quick and easy clone method.
 *
 * Does not work on circular references; should not be used
 * on objects with event listeners.
 *
 *      var newObj = Utils.clone(oldObj);
 *
 * @method
 * @param  {Object}     Object to clone
 * @return {Object}     New Object
 */
exports.clone = function (obj) {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Execute this function asynchronously.
 *
 * Defer will use SOME technique to delay execution of your function.
 * Defer() is intended for anything that should be processed after current execution has
 * completed, even if that means 0ms delay.
 *
 *      defer(function() {alert('That wasn't very long now was it!');});
 *
 * TODO: WEB-842: Add a postMessage handler.
 *
 * @method
 * @param  {Function} f
 */
exports.defer = function (func) {
  return setTimeout(func, 0);
};

/**
 * URL Decode a URL Encoded base64 string
 *
 * Copied from https://github.com/auth0-blog/angular-token-auth, but
 * appears in many places on the web.
 */
exports.decode = function (str) {
  var output = str.replace('-', '+').replace('_', '/');
  switch (output.length % 4) {
    case 0:
      break;
    case 2:
      output += '==';
      break;
    case 3:
      output += '=';
      break;
    default:
      throw new Error('Illegal base64url string!');
  }
  return atob(output);
};

/**
 * Returns a delay in seconds needed to follow an exponential
 * backoff pattern of delays for retrying a connection.
 *
 * Algorithm has two motivations:
 *
 * 1. Retry with increasingly long intervals up to some maximum interval
 * 2. Randomize the retry interval enough so that a thousand clients
 * all following the same algorithm at the same time will not hit the
 * server at the exact same times.
 *
 * The following are results before jitter for some values of counter:

      0: 0.1
      1: 0.2
      2: 0.4
      3: 0.8
      4: 1.6
      5: 3.2
      6: 6.4
      7: 12.8
      8: 25.6
      9: 51.2
      10: 102.4
      11. 204.8
      12. 409.6
      13. 819.2
      14. 1638.4 (27 minutes)

 * @method getExponentialBackoffSeconds
 * @param  {number} maxSeconds - This is not the maximum seconds delay, but rather
 * the maximum seconds delay BEFORE adding a randomized value.
 * @param  {number} counter - Current counter to use for calculating the delay; should be incremented up to some reasonable maximum value for each use.
 * @return {number}     Delay in seconds/fractions of a second
 */
exports.getExponentialBackoffSeconds = function getExponentialBackoffSeconds(maxSeconds, counter) {
  var secondsWaitTime = Math.pow(2, counter) / 10,
      secondsOffset = Math.random(); // value between 0-1 seconds.
  if (counter < 2) secondsOffset = secondsOffset / 4; // values less than 0.2 should be offset by 0-0.25 seconds
  else if (counter < 6) secondsOffset = secondsOffset / 2; // values between 0.2 and 1.0 should be offset by 0-0.5 seconds

  if (secondsWaitTime >= maxSeconds) secondsWaitTime = maxSeconds;

  return secondsWaitTime + secondsOffset;
};

/**
 * Is this data a blob?
 *
 * @method isBlob
 * @param {Mixed} value
 * @returns {Boolean} - True if its a blob, false if not.
 */
exports.isBlob = function (value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
};

/**
 * Given a blob return a base64 string.
 *
 * @method blobToBase64
 * @param {Blob} blob - data to convert to base64
 * @param {Function} callback
 * @param {String} callback.result - Your base64 string result
 */
exports.blobToBase64 = function (blob, callback) {
  var reader = new LocalFileReader();
  reader.readAsDataURL(blob);
  reader.onloadend = function () {
    return callback(reader.result.replace(/^.*?,/, ''));
  };
};

/**
 * Given a base64 string return a blob.
 *
 * @method base64ToBlob
 * @param {String} b64Data - base64 string data without any type prefixes
 * @param {String} contentType - mime type of the data
 * @returns {Blob}
 */
exports.base64ToBlob = function (b64Data, contentType) {
  try {
    var sliceSize = 512;
    var byteCharacters = atob(b64Data);
    var byteArrays = [];
    var offset = void 0;

    for (offset = 0; offset < byteCharacters.length; offset += sliceSize) {
      var i = void 0;
      var slice = byteCharacters.slice(offset, offset + sliceSize);
      var byteNumbers = new Array(slice.length);
      for (i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }

      var byteArray = new Uint8Array(byteNumbers);

      byteArrays.push(byteArray);
    }

    var blob = new Blob(byteArrays, { type: contentType });
    return blob;
  } catch (e) {
    // noop
  }
  return null;
};

/**
 * Does window.btao() in a unicode-safe way
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
 *
 * @method utoa
 * @param {String} str
 * @return {String}
 */
exports.utoa = function (str) {
  return btoa(unescape(encodeURIComponent(str)));
};

/**
 * Does window.atob() in a way that can decode data from utoa()
 *
 * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/btoa#Unicode_strings
 *
 * @method atou
 * @param {String} str
 * @return {String}
 */
exports.atou = function (str) {
  return decodeURIComponent(escape(atob(str)));
};

/**
 * Given a File/Blob return a string.
 *
 * Assumes blob represents textual data.
 *
 * @method fetchTextFromFile
 * @param {Blob} file
 * @param {Function} callback
 * @param {String} callback.result
 */
exports.fetchTextFromFile = function (file, callback) {
  if (typeof file === 'string') return callback(file);
  var reader = new LocalFileReader();
  reader.addEventListener('loadend', function () {
    callback(reader.result);
  });
  reader.readAsText(file);
};

var parser = void 0;

/**
 * Creates a LayerParser
 *
 * @method
 * @private
 * @param {Object} request - see layer.ClientUtils.layerParse
 */
function createParser(request) {
  request.client.once('destroy', function () {
    return parser = null;
  });

  parser = new LayerParser({
    camelCase: true,
    getObjectCallback: function getObjectCallback(id) {
      return request.client._getObject(id);
    },
    createObjectCallback: function createObjectCallback(id, obj) {
      return request.client._createObject(obj);
    },
    propertyNameMap: {
      Conversation: {
        unreadMessageCount: 'unreadCount'
      }
    },
    changeCallbacks: {
      Message: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      },
      Conversation: {
        all: function all(updateObject, newValue, oldValue, paths) {
          updateObject._handlePatchEvent(newValue, oldValue, paths);
        }
      }
    }
  });
}

/**
 * Run the Layer Parser on the request.
 *
 * Parameters here
 * are the parameters specied in [Layer-Patch](https://github.com/layerhq/node-layer-patch), plus
 * a client object.
 *
 *      Util.layerParse({
 *          object: conversation,
 *          type: 'Conversation',
 *          operations: layerPatchOperations,
 *          client: client
 *      });
 *
 * @method
 * @param {Object} request - layer-patch parameters
 * @param {Object} request.object - Object being updated  by the operations
 * @param {string} request.type - Type of object being updated
 * @param {Object[]} request.operations - Array of change operations to perform upon the object
 * @param {layer.Client} request.client
 */
exports.layerParse = function (request) {
  if (!parser) createParser(request);
  parser.parse(request);
};

/**
 * Object comparison.
 *
 * Does a recursive traversal of two objects verifying that they are the same.
 * Is able to make metadata-restricted assumptions such as that
 * all values are either plain Objects or strings.
 *
 *      if (Utils.doesObjectMatch(conv1.metadata, conv2.metadata)) {
 *          alert('These two metadata objects are the same');
 *      }
 *
 * @method
 * @param  {Object} requestedData
 * @param  {Object} actualData
 * @return {boolean}
 */
exports.doesObjectMatch = function (requestedData, actualData) {
  if (!requestedData && actualData || requestedData && !actualData) return false;
  var requestedKeys = Object.keys(requestedData).sort();
  var actualKeys = Object.keys(actualData).sort();

  // If there are a different number of keys, fail.
  if (requestedKeys.length !== actualKeys.length) return false;

  // Compare key name and value at each index
  for (var index = 0; index < requestedKeys.length; index++) {
    var k1 = requestedKeys[index];
    var k2 = actualKeys[index];
    var v1 = requestedData[k1];
    var v2 = actualData[k2];
    if (k1 !== k2) return false;
    if (v1 && (typeof v1 === 'undefined' ? 'undefined' : _typeof(v1)) === 'object') {
      // Array comparison is not used by the Web SDK at this time.
      if (Array.isArray(v1)) {
        throw new Error('Array comparison not handled yet');
      } else if (!exports.doesObjectMatch(v1, v2)) {
        return false;
      }
    } else if (v1 !== v2) {
      return false;
    }
  }
  return true;
};

/**
 * Simple array inclusion test
 * @method includes
 * @param {Mixed[]} items
 * @param {Mixed} value
 * @returns {boolean}
 */
exports.includes = function (items, value) {
  return items.indexOf(value) !== -1;
};

/**
 * Some ASCII art when client initializes
 */
exports.asciiInit = function (version) {
  if (!version) return 'Missing version';

  var split = version.split('-');
  var line1 = split[0] || '';
  var line2 = split[1] || '';

  line1 += new Array(13 - line1.length).join(' ');
  line2 += new Array(14 - line2.length).join(' ');

  return '\n    /hNMMMMMMMMMMMMMMMMMMMms.\n  hMMy+/////////////////omMN-        \'oo.\n  MMN                    oMMo        .MM/\n  MMN                    oMMo        .MM/              ....                       ....            ...\n  MMN       Web SDK      oMMo        .MM/           ohdddddddo\' +md.      smy  -sddddddho.   hmosddmm.\n  MMM-                   oMMo        .MM/           ::.\'  \'.mM+ \'hMd\'    +Mm. +Nm/\'   .+Nm-  mMNs-\'.\n  MMMy      v' + line1 + 'oMMo        .MM/             .-:/+yNMs  .mMs   /MN: .MMs///////dMh  mMy\n  MMMMo     ' + line2 + 'oMMo        .MM/          .ymhyso+:hMs   :MM/ -NM/  :MMsooooooooo+  mM+\n  MMMMMy.                oMMo        .MM/          dMy\'    \'dMs    +MN:mM+   \'NMo            mM+\n  MMMMMMNy:\'             oMMo        .MMy++++++++: sMm/---/dNMs     yMMMs     -dMd+:-:/smy\'  mM+\n  NMMMMMMMMmy+:-.\'      \'yMM/        \'yyyyyyyyyyyo  :shhhys:+y/     .MMh       \'-oyhhhys:\'   sy:\n  :dMMMMMMMMMMMMNNNNNNNNNMNs                                        hMd\'\n   -/+++++++++++++++++++:\'                                      sNmdo\'';
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9jbGllbnQtdXRpbHMuanMiXSwibmFtZXMiOlsiTGF5ZXJQYXJzZXIiLCJyZXF1aXJlIiwidXVpZCIsImF0b2IiLCJ3aW5kb3ciLCJMb2NhbEZpbGVSZWFkZXIiLCJGaWxlUmVhZGVyIiwiZXhwb3J0cyIsImdlbmVyYXRlVVVJRCIsInY0IiwidHlwZUZyb21JRCIsImlkIiwibWF0Y2hlcyIsIm1hdGNoIiwiaXNFbXB0eSIsIm9iaiIsIk9iamVjdCIsInByb3RvdHlwZSIsInRvU3RyaW5nIiwiYXBwbHkiLCJrZXlzIiwibGVuZ3RoIiwic29ydEJ5IiwiaW5BcnJheSIsImZuIiwicmV2ZXJzZSIsInNvcnQiLCJ2YWx1ZUEiLCJ2YWx1ZUIiLCJhYSIsImJiIiwidW5kZWZpbmVkIiwiY2xvbmUiLCJKU09OIiwicGFyc2UiLCJzdHJpbmdpZnkiLCJkZWZlciIsImZ1bmMiLCJzZXRUaW1lb3V0IiwiZGVjb2RlIiwic3RyIiwib3V0cHV0IiwicmVwbGFjZSIsIkVycm9yIiwiZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyIsIm1heFNlY29uZHMiLCJjb3VudGVyIiwic2Vjb25kc1dhaXRUaW1lIiwiTWF0aCIsInBvdyIsInNlY29uZHNPZmZzZXQiLCJyYW5kb20iLCJpc0Jsb2IiLCJ2YWx1ZSIsIkJsb2IiLCJibG9iVG9CYXNlNjQiLCJibG9iIiwiY2FsbGJhY2siLCJyZWFkZXIiLCJyZWFkQXNEYXRhVVJMIiwib25sb2FkZW5kIiwicmVzdWx0IiwiYmFzZTY0VG9CbG9iIiwiYjY0RGF0YSIsImNvbnRlbnRUeXBlIiwic2xpY2VTaXplIiwiYnl0ZUNoYXJhY3RlcnMiLCJieXRlQXJyYXlzIiwib2Zmc2V0IiwiaSIsInNsaWNlIiwiYnl0ZU51bWJlcnMiLCJBcnJheSIsImNoYXJDb2RlQXQiLCJieXRlQXJyYXkiLCJVaW50OEFycmF5IiwicHVzaCIsInR5cGUiLCJlIiwidXRvYSIsImJ0b2EiLCJ1bmVzY2FwZSIsImVuY29kZVVSSUNvbXBvbmVudCIsImF0b3UiLCJkZWNvZGVVUklDb21wb25lbnQiLCJlc2NhcGUiLCJmZXRjaFRleHRGcm9tRmlsZSIsImZpbGUiLCJhZGRFdmVudExpc3RlbmVyIiwicmVhZEFzVGV4dCIsInBhcnNlciIsImNyZWF0ZVBhcnNlciIsInJlcXVlc3QiLCJjbGllbnQiLCJvbmNlIiwiY2FtZWxDYXNlIiwiZ2V0T2JqZWN0Q2FsbGJhY2siLCJfZ2V0T2JqZWN0IiwiY3JlYXRlT2JqZWN0Q2FsbGJhY2siLCJfY3JlYXRlT2JqZWN0IiwicHJvcGVydHlOYW1lTWFwIiwiQ29udmVyc2F0aW9uIiwidW5yZWFkTWVzc2FnZUNvdW50IiwiY2hhbmdlQ2FsbGJhY2tzIiwiTWVzc2FnZSIsImFsbCIsInVwZGF0ZU9iamVjdCIsIm5ld1ZhbHVlIiwib2xkVmFsdWUiLCJwYXRocyIsIl9oYW5kbGVQYXRjaEV2ZW50IiwibGF5ZXJQYXJzZSIsImRvZXNPYmplY3RNYXRjaCIsInJlcXVlc3RlZERhdGEiLCJhY3R1YWxEYXRhIiwicmVxdWVzdGVkS2V5cyIsImFjdHVhbEtleXMiLCJpbmRleCIsImsxIiwiazIiLCJ2MSIsInYyIiwiaXNBcnJheSIsImluY2x1ZGVzIiwiaXRlbXMiLCJpbmRleE9mIiwiYXNjaWlJbml0IiwidmVyc2lvbiIsInNwbGl0IiwibGluZTEiLCJsaW5lMiIsImpvaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7Ozs7O0FBTUEsSUFBTUEsY0FBY0MsUUFBUSxhQUFSLENBQXBCO0FBQ0EsSUFBTUMsT0FBT0QsUUFBUSxNQUFSLENBQWI7QUFDQSxJQUFNRSxPQUFPLE9BQU9DLE1BQVAsS0FBa0IsV0FBbEIsR0FBZ0NILFFBQVEsTUFBUixDQUFoQyxHQUFrREcsT0FBT0QsSUFBdEU7O0FBRUE7QUFDQSxJQUFNRSxrQkFBa0IsT0FBT0QsTUFBUCxLQUFrQixXQUFsQixHQUFnQ0gsUUFBUSxZQUFSLENBQWhDLEdBQXdERyxPQUFPRSxVQUF2Rjs7QUFFQTs7Ozs7O0FBTUFDLFFBQVFDLFlBQVIsR0FBdUJOLEtBQUtPLEVBQTVC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SUFBUDtBQUNELENBM0JEOztBQTZCQTs7Ozs7OztBQU9BbEgsUUFBUW9ILFFBQVIsR0FBbUIsVUFBQ0MsS0FBRCxFQUFRdkUsS0FBUjtBQUFBLFNBQWtCdUUsTUFBTUMsT0FBTixDQUFjeEUsS0FBZCxNQUF5QixDQUFDLENBQTVDO0FBQUEsQ0FBbkI7O0FBRUE7OztBQUdBOUMsUUFBUXVILFNBQVIsR0FBb0IsVUFBQ0MsT0FBRCxFQUFhO0FBQy9CLE1BQUksQ0FBQ0EsT0FBTCxFQUFjLE9BQU8saUJBQVA7O0FBRWQsTUFBTUMsUUFBUUQsUUFBUUMsS0FBUixDQUFjLEdBQWQsQ0FBZDtBQUNBLE1BQUlDLFFBQVFELE1BQU0sQ0FBTixLQUFZLEVBQXhCO0FBQ0EsTUFBSUUsUUFBUUYsTUFBTSxDQUFOLEtBQVksRUFBeEI7O0FBRUFDLFdBQVMsSUFBSXpELEtBQUosQ0FBVSxLQUFLeUQsTUFBTTVHLE1BQXJCLEVBQTZCOEcsSUFBN0IsQ0FBa0MsR0FBbEMsQ0FBVDtBQUNBRCxXQUFTLElBQUkxRCxLQUFKLENBQVUsS0FBSzBELE1BQU03RyxNQUFyQixFQUE2QjhHLElBQTdCLENBQWtDLEdBQWxDLENBQVQ7O0FBRUEsK2NBT2FGLEtBUGIsNkZBUVlDLEtBUlo7QUFjQSxDQXhCRiIsImZpbGUiOiJjbGllbnQtdXRpbHMuanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIFV0aWxpdHkgbWV0aG9kc1xuICpcbiAqIEBjbGFzcyBsYXllci5DbGllbnRVdGlsc1xuICovXG5cbmNvbnN0IExheWVyUGFyc2VyID0gcmVxdWlyZSgnbGF5ZXItcGF0Y2gnKTtcbmNvbnN0IHV1aWQgPSByZXF1aXJlKCd1dWlkJyk7XG5jb25zdCBhdG9iID0gdHlwZW9mIHdpbmRvdyA9PT0gJ3VuZGVmaW5lZCcgPyByZXF1aXJlKCdhdG9iJykgOiB3aW5kb3cuYXRvYjtcblxuLyogaXN0YW5idWwgaWdub3JlIG5leHQgKi9cbmNvbnN0IExvY2FsRmlsZVJlYWRlciA9IHR5cGVvZiB3aW5kb3cgPT09ICd1bmRlZmluZWQnID8gcmVxdWlyZSgnZmlsZXJlYWRlcicpIDogd2luZG93LkZpbGVSZWFkZXI7XG5cbi8qKlxuICogR2VuZXJhdGUgYSByYW5kb20gVVVJRFxuICpcbiAqIEBtZXRob2RcbiAqIEByZXR1cm4ge3N0cmluZ31cbiAqL1xuZXhwb3J0cy5nZW5lcmF0ZVVVSUQgPSB1dWlkLnY0O1xuXG5cbi8qKlxuICogUmV0dXJucyB0aGUgJ3R5cGUnIHBvcnRpb24gb2YgYSBMYXllciBJRC5cbiAqXG4gKiAgICAgICAgIHN3aXRjaChVdGlscy50eXBlRnJvbUlEKGlkKSkge1xuICogICAgICAgICAgICAgY2FzZSAnY29udmVyc2F0aW9ucyc6XG4gKiAgICAgICAgICAgICAgICAgLi4uXG4gKiAgICAgICAgICAgICBjYXNlICdtZXNzYWdlJzpcbiAqICAgICAgICAgICAgICAgICAuLi5cbiAqICAgICAgICAgICAgIGNhc2U6ICdxdWVyaWVzJzpcbiAqICAgICAgICAgICAgICAgICAuLi5cbiAqICAgICAgICAgfVxuICpcbiAqIERvZXMgbm90IGN1cnJlbnRseSBoYW5kbGUgTGF5ZXIgQXBwIElEcy5cbiAqXG4gKiBAbWV0aG9kXG4gKiBAcGFyYW0gIHtzdHJpbmd9IGlkXG4gKiBAcmV0dXJuIHtzdHJpbmd9XG4gKi9cbmV4cG9ydHMudHlwZUZyb21JRCA9IChpZCkgPT4ge1xuICBjb25zdCBtYXRjaGVzID0gaWQubWF0Y2goL2xheWVyOlxcL1xcL1xcLyguKj8pXFwvLyk7XG4gIHJldHVybiBtYXRjaGVzID8gbWF0Y2hlc1sxXSA6ICcnO1xufTtcblxuZXhwb3J0cy5pc0VtcHR5ID0gKG9iaikgPT4gT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZy5hcHBseShvYmopID09PSAnW29iamVjdCBPYmplY3RdJyAmJiBPYmplY3Qua2V5cyhvYmopLmxlbmd0aCA9PT0gMDtcblxuLyoqXG4gKiBTaW1wbGlmaWVkIHNvcnQgbWV0aG9kLlxuICpcbiAqIFByb3ZpZGVzIGEgZnVuY3Rpb24gdG8gcmV0dXJuIHRoZSB2YWx1ZSB0byBjb21wYXJlIHJhdGhlciB0aGFuIGRvIHRoZSBjb21wYXJpc29uLlxuICpcbiAqICAgICAgc29ydEJ5KFt7djogM30sIHt2OiAxfSwgdjogMzN9XSwgZnVuY3Rpb24odmFsdWUpIHtcbiAqICAgICAgICAgIHJldHVybiB2YWx1ZS52O1xuICogICAgICB9LCBmYWxzZSk7XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7TWl4ZWRbXX0gICBpbkFycmF5ICAgICAgQXJyYXkgdG8gc29ydFxuICogQHBhcmFtICB7RnVuY3Rpb259IGZuICAgICAgICAgICAgRnVuY3Rpb24gdGhhdCB3aWxsIHJldHVybiBhIHZhbHVlIHRvIGNvbXBhcmVcbiAqIEBwYXJhbSAge0Z1bmN0aW9ufSBmbi52YWx1ZSAgICAgIEN1cnJlbnQgdmFsdWUgZnJvbSBpbkFycmF5IHdlIGFyZSBjb21wYXJpbmcsIGFuZCBmcm9tIHdoaWNoIGEgdmFsdWUgc2hvdWxkIGJlIGV4dHJhY3RlZFxuICogQHBhcmFtICB7Ym9vbGVhbn0gIFtyZXZlcnNlPWZhbHNlXSBTb3J0IGFzY2VuZGluZyAoZmFsc2UpIG9yIGRlc2NlbmRpbmcgKHRydWUpXG4gKi9cbmV4cG9ydHMuc29ydEJ5ID0gKGluQXJyYXksIGZuLCByZXZlcnNlKSA9PiB7XG4gIHJldmVyc2UgPSByZXZlcnNlID8gLTEgOiAxO1xuICByZXR1cm4gaW5BcnJheS5zb3J0KCh2YWx1ZUEsIHZhbHVlQikgPT4ge1xuICAgIGNvbnN0IGFhID0gZm4odmFsdWVBKTtcbiAgICBjb25zdCBiYiA9IGZuKHZhbHVlQik7XG4gICAgaWYgKGFhID09PSB1bmRlZmluZWQgJiYgYmIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIDA7XG4gICAgaWYgKGFhID09PSB1bmRlZmluZWQgJiYgYmIgIT09IHVuZGVmaW5lZCkgcmV0dXJuIDE7XG4gICAgaWYgKGFhICE9PSB1bmRlZmluZWQgJiYgYmIgPT09IHVuZGVmaW5lZCkgcmV0dXJuIC0xO1xuICAgIGlmIChhYSA+IGJiKSByZXR1cm4gMSAqIHJldmVyc2U7XG4gICAgaWYgKGFhIDwgYmIpIHJldHVybiAtMSAqIHJldmVyc2U7XG4gICAgcmV0dXJuIDA7XG4gIH0pO1xufTtcblxuLyoqXG4gKiBRdWljayBhbmQgZWFzeSBjbG9uZSBtZXRob2QuXG4gKlxuICogRG9lcyBub3Qgd29yayBvbiBjaXJjdWxhciByZWZlcmVuY2VzOyBzaG91bGQgbm90IGJlIHVzZWRcbiAqIG9uIG9iamVjdHMgd2l0aCBldmVudCBsaXN0ZW5lcnMuXG4gKlxuICogICAgICB2YXIgbmV3T2JqID0gVXRpbHMuY2xvbmUob2xkT2JqKTtcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcGFyYW0gIHtPYmplY3R9ICAgICBPYmplY3QgdG8gY2xvbmVcbiAqIEByZXR1cm4ge09iamVjdH0gICAgIE5ldyBPYmplY3RcbiAqL1xuZXhwb3J0cy5jbG9uZSA9IChvYmopID0+IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkob2JqKSk7XG5cbi8qKlxuICogRXhlY3V0ZSB0aGlzIGZ1bmN0aW9uIGFzeW5jaHJvbm91c2x5LlxuICpcbiAqIERlZmVyIHdpbGwgdXNlIFNPTUUgdGVjaG5pcXVlIHRvIGRlbGF5IGV4ZWN1dGlvbiBvZiB5b3VyIGZ1bmN0aW9uLlxuICogRGVmZXIoKSBpcyBpbnRlbmRlZCBmb3IgYW55dGhpbmcgdGhhdCBzaG91bGQgYmUgcHJvY2Vzc2VkIGFmdGVyIGN1cnJlbnQgZXhlY3V0aW9uIGhhc1xuICogY29tcGxldGVkLCBldmVuIGlmIHRoYXQgbWVhbnMgMG1zIGRlbGF5LlxuICpcbiAqICAgICAgZGVmZXIoZnVuY3Rpb24oKSB7YWxlcnQoJ1RoYXQgd2Fzbid0IHZlcnkgbG9uZyBub3cgd2FzIGl0IScpO30pO1xuICpcbiAqIFRPRE86IFdFQi04NDI6IEFkZCBhIHBvc3RNZXNzYWdlIGhhbmRsZXIuXG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7RnVuY3Rpb259IGZcbiAqL1xuZXhwb3J0cy5kZWZlciA9IChmdW5jKSA9PiBzZXRUaW1lb3V0KGZ1bmMsIDApO1xuXG4vKipcbiAqIFVSTCBEZWNvZGUgYSBVUkwgRW5jb2RlZCBiYXNlNjQgc3RyaW5nXG4gKlxuICogQ29waWVkIGZyb20gaHR0cHM6Ly9naXRodWIuY29tL2F1dGgwLWJsb2cvYW5ndWxhci10b2tlbi1hdXRoLCBidXRcbiAqIGFwcGVhcnMgaW4gbWFueSBwbGFjZXMgb24gdGhlIHdlYi5cbiAqL1xuZXhwb3J0cy5kZWNvZGUgPSAoc3RyKSA9PiB7XG4gIGxldCBvdXRwdXQgPSBzdHIucmVwbGFjZSgnLScsICcrJykucmVwbGFjZSgnXycsICcvJyk7XG4gIHN3aXRjaCAob3V0cHV0Lmxlbmd0aCAlIDQpIHtcbiAgICBjYXNlIDA6XG4gICAgICBicmVhaztcbiAgICBjYXNlIDI6XG4gICAgICBvdXRwdXQgKz0gJz09JztcbiAgICAgIGJyZWFrO1xuICAgIGNhc2UgMzpcbiAgICAgIG91dHB1dCArPSAnPSc7XG4gICAgICBicmVhaztcbiAgICBkZWZhdWx0OlxuICAgICAgdGhyb3cgbmV3IEVycm9yKCdJbGxlZ2FsIGJhc2U2NHVybCBzdHJpbmchJyk7XG4gIH1cbiAgcmV0dXJuIGF0b2Iob3V0cHV0KTtcbn07XG5cblxuLyoqXG4gKiBSZXR1cm5zIGEgZGVsYXkgaW4gc2Vjb25kcyBuZWVkZWQgdG8gZm9sbG93IGFuIGV4cG9uZW50aWFsXG4gKiBiYWNrb2ZmIHBhdHRlcm4gb2YgZGVsYXlzIGZvciByZXRyeWluZyBhIGNvbm5lY3Rpb24uXG4gKlxuICogQWxnb3JpdGhtIGhhcyB0d28gbW90aXZhdGlvbnM6XG4gKlxuICogMS4gUmV0cnkgd2l0aCBpbmNyZWFzaW5nbHkgbG9uZyBpbnRlcnZhbHMgdXAgdG8gc29tZSBtYXhpbXVtIGludGVydmFsXG4gKiAyLiBSYW5kb21pemUgdGhlIHJldHJ5IGludGVydmFsIGVub3VnaCBzbyB0aGF0IGEgdGhvdXNhbmQgY2xpZW50c1xuICogYWxsIGZvbGxvd2luZyB0aGUgc2FtZSBhbGdvcml0aG0gYXQgdGhlIHNhbWUgdGltZSB3aWxsIG5vdCBoaXQgdGhlXG4gKiBzZXJ2ZXIgYXQgdGhlIGV4YWN0IHNhbWUgdGltZXMuXG4gKlxuICogVGhlIGZvbGxvd2luZyBhcmUgcmVzdWx0cyBiZWZvcmUgaml0dGVyIGZvciBzb21lIHZhbHVlcyBvZiBjb3VudGVyOlxuXG4gICAgICAwOiAwLjFcbiAgICAgIDE6IDAuMlxuICAgICAgMjogMC40XG4gICAgICAzOiAwLjhcbiAgICAgIDQ6IDEuNlxuICAgICAgNTogMy4yXG4gICAgICA2OiA2LjRcbiAgICAgIDc6IDEyLjhcbiAgICAgIDg6IDI1LjZcbiAgICAgIDk6IDUxLjJcbiAgICAgIDEwOiAxMDIuNFxuICAgICAgMTEuIDIwNC44XG4gICAgICAxMi4gNDA5LjZcbiAgICAgIDEzLiA4MTkuMlxuICAgICAgMTQuIDE2MzguNCAoMjcgbWludXRlcylcblxuICogQG1ldGhvZCBnZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzXG4gKiBAcGFyYW0gIHtudW1iZXJ9IG1heFNlY29uZHMgLSBUaGlzIGlzIG5vdCB0aGUgbWF4aW11bSBzZWNvbmRzIGRlbGF5LCBidXQgcmF0aGVyXG4gKiB0aGUgbWF4aW11bSBzZWNvbmRzIGRlbGF5IEJFRk9SRSBhZGRpbmcgYSByYW5kb21pemVkIHZhbHVlLlxuICogQHBhcmFtICB7bnVtYmVyfSBjb3VudGVyIC0gQ3VycmVudCBjb3VudGVyIHRvIHVzZSBmb3IgY2FsY3VsYXRpbmcgdGhlIGRlbGF5OyBzaG91bGQgYmUgaW5jcmVtZW50ZWQgdXAgdG8gc29tZSByZWFzb25hYmxlIG1heGltdW0gdmFsdWUgZm9yIGVhY2ggdXNlLlxuICogQHJldHVybiB7bnVtYmVyfSAgICAgRGVsYXkgaW4gc2Vjb25kcy9mcmFjdGlvbnMgb2YgYSBzZWNvbmRcbiAqL1xuZXhwb3J0cy5nZXRFeHBvbmVudGlhbEJhY2tvZmZTZWNvbmRzID0gZnVuY3Rpb24gZ2V0RXhwb25lbnRpYWxCYWNrb2ZmU2Vjb25kcyhtYXhTZWNvbmRzLCBjb3VudGVyKSB7XG4gIGxldCBzZWNvbmRzV2FpdFRpbWUgPSBNYXRoLnBvdygyLCBjb3VudGVyKSAvIDEwLFxuICAgIHNlY29uZHNPZmZzZXQgPSBNYXRoLnJhbmRvbSgpOyAvLyB2YWx1ZSBiZXR3ZWVuIDAtMSBzZWNvbmRzLlxuICBpZiAoY291bnRlciA8IDIpIHNlY29uZHNPZmZzZXQgPSBzZWNvbmRzT2Zmc2V0IC8gNDsgLy8gdmFsdWVzIGxlc3MgdGhhbiAwLjIgc2hvdWxkIGJlIG9mZnNldCBieSAwLTAuMjUgc2Vjb25kc1xuICBlbHNlIGlmIChjb3VudGVyIDwgNikgc2Vjb25kc09mZnNldCA9IHNlY29uZHNPZmZzZXQgLyAyOyAvLyB2YWx1ZXMgYmV0d2VlbiAwLjIgYW5kIDEuMCBzaG91bGQgYmUgb2Zmc2V0IGJ5IDAtMC41IHNlY29uZHNcblxuICBpZiAoc2Vjb25kc1dhaXRUaW1lID49IG1heFNlY29uZHMpIHNlY29uZHNXYWl0VGltZSA9IG1heFNlY29uZHM7XG5cbiAgcmV0dXJuIHNlY29uZHNXYWl0VGltZSArIHNlY29uZHNPZmZzZXQ7XG59O1xuXG4vKipcbiAqIElzIHRoaXMgZGF0YSBhIGJsb2I/XG4gKlxuICogQG1ldGhvZCBpc0Jsb2JcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gKiBAcmV0dXJucyB7Qm9vbGVhbn0gLSBUcnVlIGlmIGl0cyBhIGJsb2IsIGZhbHNlIGlmIG5vdC5cbiAqL1xuZXhwb3J0cy5pc0Jsb2IgPSAodmFsdWUpID0+IHR5cGVvZiBCbG9iICE9PSAndW5kZWZpbmVkJyAmJiB2YWx1ZSBpbnN0YW5jZW9mIEJsb2I7XG5cbi8qKlxuICogR2l2ZW4gYSBibG9iIHJldHVybiBhIGJhc2U2NCBzdHJpbmcuXG4gKlxuICogQG1ldGhvZCBibG9iVG9CYXNlNjRcbiAqIEBwYXJhbSB7QmxvYn0gYmxvYiAtIGRhdGEgdG8gY29udmVydCB0byBiYXNlNjRcbiAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gKiBAcGFyYW0ge1N0cmluZ30gY2FsbGJhY2sucmVzdWx0IC0gWW91ciBiYXNlNjQgc3RyaW5nIHJlc3VsdFxuICovXG5leHBvcnRzLmJsb2JUb0Jhc2U2NCA9IChibG9iLCBjYWxsYmFjaykgPT4ge1xuICBjb25zdCByZWFkZXIgPSBuZXcgTG9jYWxGaWxlUmVhZGVyKCk7XG4gIHJlYWRlci5yZWFkQXNEYXRhVVJMKGJsb2IpO1xuICByZWFkZXIub25sb2FkZW5kID0gKCkgPT4gY2FsbGJhY2socmVhZGVyLnJlc3VsdC5yZXBsYWNlKC9eLio/LC8sICcnKSk7XG59O1xuXG5cbi8qKlxuICogR2l2ZW4gYSBiYXNlNjQgc3RyaW5nIHJldHVybiBhIGJsb2IuXG4gKlxuICogQG1ldGhvZCBiYXNlNjRUb0Jsb2JcbiAqIEBwYXJhbSB7U3RyaW5nfSBiNjREYXRhIC0gYmFzZTY0IHN0cmluZyBkYXRhIHdpdGhvdXQgYW55IHR5cGUgcHJlZml4ZXNcbiAqIEBwYXJhbSB7U3RyaW5nfSBjb250ZW50VHlwZSAtIG1pbWUgdHlwZSBvZiB0aGUgZGF0YVxuICogQHJldHVybnMge0Jsb2J9XG4gKi9cbmV4cG9ydHMuYmFzZTY0VG9CbG9iID0gKGI2NERhdGEsIGNvbnRlbnRUeXBlKSA9PiB7XG4gIHRyeSB7XG4gICAgY29uc3Qgc2xpY2VTaXplID0gNTEyO1xuICAgIGNvbnN0IGJ5dGVDaGFyYWN0ZXJzID0gYXRvYihiNjREYXRhKTtcbiAgICBjb25zdCBieXRlQXJyYXlzID0gW107XG4gICAgbGV0IG9mZnNldDtcblxuICAgIGZvciAob2Zmc2V0ID0gMDsgb2Zmc2V0IDwgYnl0ZUNoYXJhY3RlcnMubGVuZ3RoOyBvZmZzZXQgKz0gc2xpY2VTaXplKSB7XG4gICAgICBsZXQgaTtcbiAgICAgIGNvbnN0IHNsaWNlID0gYnl0ZUNoYXJhY3RlcnMuc2xpY2Uob2Zmc2V0LCBvZmZzZXQgKyBzbGljZVNpemUpO1xuICAgICAgY29uc3QgYnl0ZU51bWJlcnMgPSBuZXcgQXJyYXkoc2xpY2UubGVuZ3RoKTtcbiAgICAgIGZvciAoaSA9IDA7IGkgPCBzbGljZS5sZW5ndGg7IGkrKykge1xuICAgICAgICBieXRlTnVtYmVyc1tpXSA9IHNsaWNlLmNoYXJDb2RlQXQoaSk7XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGJ5dGVBcnJheSA9IG5ldyBVaW50OEFycmF5KGJ5dGVOdW1iZXJzKTtcblxuICAgICAgYnl0ZUFycmF5cy5wdXNoKGJ5dGVBcnJheSk7XG4gICAgfVxuXG4gICAgY29uc3QgYmxvYiA9IG5ldyBCbG9iKGJ5dGVBcnJheXMsIHsgdHlwZTogY29udGVudFR5cGUgfSk7XG4gICAgcmV0dXJuIGJsb2I7XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICAvLyBub29wXG4gIH1cbiAgcmV0dXJuIG51bGw7XG59O1xuXG4vKipcbiAqIERvZXMgd2luZG93LmJ0YW8oKSBpbiBhIHVuaWNvZGUtc2FmZSB3YXlcbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93QmFzZTY0L2J0b2EjVW5pY29kZV9zdHJpbmdzXG4gKlxuICogQG1ldGhvZCB1dG9hXG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmV4cG9ydHMudXRvYSA9IChzdHIpID0+IGJ0b2EodW5lc2NhcGUoZW5jb2RlVVJJQ29tcG9uZW50KHN0cikpKTtcblxuLyoqXG4gKiBEb2VzIHdpbmRvdy5hdG9iKCkgaW4gYSB3YXkgdGhhdCBjYW4gZGVjb2RlIGRhdGEgZnJvbSB1dG9hKClcbiAqXG4gKiBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvV2luZG93QmFzZTY0L2J0b2EjVW5pY29kZV9zdHJpbmdzXG4gKlxuICogQG1ldGhvZCBhdG91XG4gKiBAcGFyYW0ge1N0cmluZ30gc3RyXG4gKiBAcmV0dXJuIHtTdHJpbmd9XG4gKi9cbmV4cG9ydHMuYXRvdSA9IChzdHIpID0+IGRlY29kZVVSSUNvbXBvbmVudChlc2NhcGUoYXRvYihzdHIpKSk7XG5cblxuLyoqXG4gKiBHaXZlbiBhIEZpbGUvQmxvYiByZXR1cm4gYSBzdHJpbmcuXG4gKlxuICogQXNzdW1lcyBibG9iIHJlcHJlc2VudHMgdGV4dHVhbCBkYXRhLlxuICpcbiAqIEBtZXRob2QgZmV0Y2hUZXh0RnJvbUZpbGVcbiAqIEBwYXJhbSB7QmxvYn0gZmlsZVxuICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAqIEBwYXJhbSB7U3RyaW5nfSBjYWxsYmFjay5yZXN1bHRcbiAqL1xuZXhwb3J0cy5mZXRjaFRleHRGcm9tRmlsZSA9IChmaWxlLCBjYWxsYmFjaykgPT4ge1xuICBpZiAodHlwZW9mIGZpbGUgPT09ICdzdHJpbmcnKSByZXR1cm4gY2FsbGJhY2soZmlsZSk7XG4gIGNvbnN0IHJlYWRlciA9IG5ldyBMb2NhbEZpbGVSZWFkZXIoKTtcbiAgcmVhZGVyLmFkZEV2ZW50TGlzdGVuZXIoJ2xvYWRlbmQnLCAoKSA9PiB7XG4gICAgY2FsbGJhY2socmVhZGVyLnJlc3VsdCk7XG4gIH0pO1xuICByZWFkZXIucmVhZEFzVGV4dChmaWxlKTtcbn07XG5cblxubGV0IHBhcnNlcjtcblxuLyoqXG4gKiBDcmVhdGVzIGEgTGF5ZXJQYXJzZXJcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcHJpdmF0ZVxuICogQHBhcmFtIHtPYmplY3R9IHJlcXVlc3QgLSBzZWUgbGF5ZXIuQ2xpZW50VXRpbHMubGF5ZXJQYXJzZVxuICovXG5mdW5jdGlvbiBjcmVhdGVQYXJzZXIocmVxdWVzdCkge1xuICByZXF1ZXN0LmNsaWVudC5vbmNlKCdkZXN0cm95JywgKCkgPT4gKHBhcnNlciA9IG51bGwpKTtcblxuICBwYXJzZXIgPSBuZXcgTGF5ZXJQYXJzZXIoe1xuICAgIGNhbWVsQ2FzZTogdHJ1ZSxcbiAgICBnZXRPYmplY3RDYWxsYmFjazogKGlkKSA9PiByZXF1ZXN0LmNsaWVudC5fZ2V0T2JqZWN0KGlkKSxcbiAgICBjcmVhdGVPYmplY3RDYWxsYmFjazogKGlkLCBvYmopID0+IHJlcXVlc3QuY2xpZW50Ll9jcmVhdGVPYmplY3Qob2JqKSxcbiAgICBwcm9wZXJ0eU5hbWVNYXA6IHtcbiAgICAgIENvbnZlcnNhdGlvbjoge1xuICAgICAgICB1bnJlYWRNZXNzYWdlQ291bnQ6ICd1bnJlYWRDb3VudCcsXG4gICAgICB9LFxuICAgIH0sXG4gICAgY2hhbmdlQ2FsbGJhY2tzOiB7XG4gICAgICBNZXNzYWdlOiB7XG4gICAgICAgIGFsbDogKHVwZGF0ZU9iamVjdCwgbmV3VmFsdWUsIG9sZFZhbHVlLCBwYXRocykgPT4ge1xuICAgICAgICAgIHVwZGF0ZU9iamVjdC5faGFuZGxlUGF0Y2hFdmVudChuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKTtcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICBDb252ZXJzYXRpb246IHtcbiAgICAgICAgYWxsOiAodXBkYXRlT2JqZWN0LCBuZXdWYWx1ZSwgb2xkVmFsdWUsIHBhdGhzKSA9PiB7XG4gICAgICAgICAgdXBkYXRlT2JqZWN0Ll9oYW5kbGVQYXRjaEV2ZW50KG5ld1ZhbHVlLCBvbGRWYWx1ZSwgcGF0aHMpO1xuICAgICAgICB9LFxuICAgICAgfSxcbiAgICB9LFxuICB9KTtcbn1cblxuLyoqXG4gKiBSdW4gdGhlIExheWVyIFBhcnNlciBvbiB0aGUgcmVxdWVzdC5cbiAqXG4gKiBQYXJhbWV0ZXJzIGhlcmVcbiAqIGFyZSB0aGUgcGFyYW1ldGVycyBzcGVjaWVkIGluIFtMYXllci1QYXRjaF0oaHR0cHM6Ly9naXRodWIuY29tL2xheWVyaHEvbm9kZS1sYXllci1wYXRjaCksIHBsdXNcbiAqIGEgY2xpZW50IG9iamVjdC5cbiAqXG4gKiAgICAgIFV0aWwubGF5ZXJQYXJzZSh7XG4gKiAgICAgICAgICBvYmplY3Q6IGNvbnZlcnNhdGlvbixcbiAqICAgICAgICAgIHR5cGU6ICdDb252ZXJzYXRpb24nLFxuICogICAgICAgICAgb3BlcmF0aW9uczogbGF5ZXJQYXRjaE9wZXJhdGlvbnMsXG4gKiAgICAgICAgICBjbGllbnQ6IGNsaWVudFxuICogICAgICB9KTtcbiAqXG4gKiBAbWV0aG9kXG4gKiBAcGFyYW0ge09iamVjdH0gcmVxdWVzdCAtIGxheWVyLXBhdGNoIHBhcmFtZXRlcnNcbiAqIEBwYXJhbSB7T2JqZWN0fSByZXF1ZXN0Lm9iamVjdCAtIE9iamVjdCBiZWluZyB1cGRhdGVkICBieSB0aGUgb3BlcmF0aW9uc1xuICogQHBhcmFtIHtzdHJpbmd9IHJlcXVlc3QudHlwZSAtIFR5cGUgb2Ygb2JqZWN0IGJlaW5nIHVwZGF0ZWRcbiAqIEBwYXJhbSB7T2JqZWN0W119IHJlcXVlc3Qub3BlcmF0aW9ucyAtIEFycmF5IG9mIGNoYW5nZSBvcGVyYXRpb25zIHRvIHBlcmZvcm0gdXBvbiB0aGUgb2JqZWN0XG4gKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gcmVxdWVzdC5jbGllbnRcbiAqL1xuZXhwb3J0cy5sYXllclBhcnNlID0gKHJlcXVlc3QpID0+IHtcbiAgaWYgKCFwYXJzZXIpIGNyZWF0ZVBhcnNlcihyZXF1ZXN0KTtcbiAgcGFyc2VyLnBhcnNlKHJlcXVlc3QpO1xufTtcblxuLyoqXG4gKiBPYmplY3QgY29tcGFyaXNvbi5cbiAqXG4gKiBEb2VzIGEgcmVjdXJzaXZlIHRyYXZlcnNhbCBvZiB0d28gb2JqZWN0cyB2ZXJpZnlpbmcgdGhhdCB0aGV5IGFyZSB0aGUgc2FtZS5cbiAqIElzIGFibGUgdG8gbWFrZSBtZXRhZGF0YS1yZXN0cmljdGVkIGFzc3VtcHRpb25zIHN1Y2ggYXMgdGhhdFxuICogYWxsIHZhbHVlcyBhcmUgZWl0aGVyIHBsYWluIE9iamVjdHMgb3Igc3RyaW5ncy5cbiAqXG4gKiAgICAgIGlmIChVdGlscy5kb2VzT2JqZWN0TWF0Y2goY29udjEubWV0YWRhdGEsIGNvbnYyLm1ldGFkYXRhKSkge1xuICogICAgICAgICAgYWxlcnQoJ1RoZXNlIHR3byBtZXRhZGF0YSBvYmplY3RzIGFyZSB0aGUgc2FtZScpO1xuICogICAgICB9XG4gKlxuICogQG1ldGhvZFxuICogQHBhcmFtICB7T2JqZWN0fSByZXF1ZXN0ZWREYXRhXG4gKiBAcGFyYW0gIHtPYmplY3R9IGFjdHVhbERhdGFcbiAqIEByZXR1cm4ge2Jvb2xlYW59XG4gKi9cbmV4cG9ydHMuZG9lc09iamVjdE1hdGNoID0gKHJlcXVlc3RlZERhdGEsIGFjdHVhbERhdGEpID0+IHtcbiAgaWYgKCFyZXF1ZXN0ZWREYXRhICYmIGFjdHVhbERhdGEgfHwgcmVxdWVzdGVkRGF0YSAmJiAhYWN0dWFsRGF0YSkgcmV0dXJuIGZhbHNlO1xuICBjb25zdCByZXF1ZXN0ZWRLZXlzID0gT2JqZWN0LmtleXMocmVxdWVzdGVkRGF0YSkuc29ydCgpO1xuICBjb25zdCBhY3R1YWxLZXlzID0gT2JqZWN0LmtleXMoYWN0dWFsRGF0YSkuc29ydCgpO1xuXG4gIC8vIElmIHRoZXJlIGFyZSBhIGRpZmZlcmVudCBudW1iZXIgb2Yga2V5cywgZmFpbC5cbiAgaWYgKHJlcXVlc3RlZEtleXMubGVuZ3RoICE9PSBhY3R1YWxLZXlzLmxlbmd0aCkgcmV0dXJuIGZhbHNlO1xuXG4gIC8vIENvbXBhcmUga2V5IG5hbWUgYW5kIHZhbHVlIGF0IGVhY2ggaW5kZXhcbiAgZm9yIChsZXQgaW5kZXggPSAwOyBpbmRleCA8IHJlcXVlc3RlZEtleXMubGVuZ3RoOyBpbmRleCsrKSB7XG4gICAgY29uc3QgazEgPSByZXF1ZXN0ZWRLZXlzW2luZGV4XTtcbiAgICBjb25zdCBrMiA9IGFjdHVhbEtleXNbaW5kZXhdO1xuICAgIGNvbnN0IHYxID0gcmVxdWVzdGVkRGF0YVtrMV07XG4gICAgY29uc3QgdjIgPSBhY3R1YWxEYXRhW2syXTtcbiAgICBpZiAoazEgIT09IGsyKSByZXR1cm4gZmFsc2U7XG4gICAgaWYgKHYxICYmIHR5cGVvZiB2MSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIC8vIEFycmF5IGNvbXBhcmlzb24gaXMgbm90IHVzZWQgYnkgdGhlIFdlYiBTREsgYXQgdGhpcyB0aW1lLlxuICAgICAgaWYgKEFycmF5LmlzQXJyYXkodjEpKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignQXJyYXkgY29tcGFyaXNvbiBub3QgaGFuZGxlZCB5ZXQnKTtcbiAgICAgIH0gZWxzZSBpZiAoIWV4cG9ydHMuZG9lc09iamVjdE1hdGNoKHYxLCB2MikpIHtcbiAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAodjEgIT09IHYyKSB7XG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuICB9XG4gIHJldHVybiB0cnVlO1xufTtcblxuLyoqXG4gKiBTaW1wbGUgYXJyYXkgaW5jbHVzaW9uIHRlc3RcbiAqIEBtZXRob2QgaW5jbHVkZXNcbiAqIEBwYXJhbSB7TWl4ZWRbXX0gaXRlbXNcbiAqIEBwYXJhbSB7TWl4ZWR9IHZhbHVlXG4gKiBAcmV0dXJucyB7Ym9vbGVhbn1cbiAqL1xuZXhwb3J0cy5pbmNsdWRlcyA9IChpdGVtcywgdmFsdWUpID0+IGl0ZW1zLmluZGV4T2YodmFsdWUpICE9PSAtMTtcblxuLyoqXG4gKiBTb21lIEFTQ0lJIGFydCB3aGVuIGNsaWVudCBpbml0aWFsaXplc1xuICovXG5leHBvcnRzLmFzY2lpSW5pdCA9ICh2ZXJzaW9uKSA9PiB7XG4gIGlmICghdmVyc2lvbikgcmV0dXJuICdNaXNzaW5nIHZlcnNpb24nO1xuXG4gIGNvbnN0IHNwbGl0ID0gdmVyc2lvbi5zcGxpdCgnLScpO1xuICBsZXQgbGluZTEgPSBzcGxpdFswXSB8fCAnJztcbiAgbGV0IGxpbmUyID0gc3BsaXRbMV0gfHwgJyc7XG5cbiAgbGluZTEgKz0gbmV3IEFycmF5KDEzIC0gbGluZTEubGVuZ3RoKS5qb2luKCcgJyk7XG4gIGxpbmUyICs9IG5ldyBBcnJheSgxNCAtIGxpbmUyLmxlbmd0aCkuam9pbignICcpO1xuXG4gIHJldHVybiBgXG4gICAgL2hOTU1NTU1NTU1NTU1NTU1NTU1NTW1zLlxuICBoTU15Ky8vLy8vLy8vLy8vLy8vLy8vb21NTi0gICAgICAgICdvby5cbiAgTU1OICAgICAgICAgICAgICAgICAgICBvTU1vICAgICAgICAuTU0vXG4gIE1NTiAgICAgICAgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NLyAgICAgICAgICAgICAgLi4uLiAgICAgICAgICAgICAgICAgICAgICAgLi4uLiAgICAgICAgICAgIC4uLlxuICBNTU4gICAgICAgV2ViIFNESyAgICAgIG9NTW8gICAgICAgIC5NTS8gICAgICAgICAgIG9oZGRkZGRkZG8nICttZC4gICAgICBzbXkgIC1zZGRkZGRkaG8uICAgaG1vc2RkbW0uXG4gIE1NTS0gICAgICAgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NLyAgICAgICAgICAgOjouJyAgJy5tTSsgJ2hNZCcgICAgK01tLiArTm0vJyAgIC4rTm0tICBtTU5zLScuXG4gIE1NTXkgICAgICB2JHtsaW5lMX1vTU1vICAgICAgICAuTU0vICAgICAgICAgICAgIC4tOi8reU5NcyAgLm1NcyAgIC9NTjogLk1Ncy8vLy8vLy9kTWggIG1NeVxuICBNTU1NbyAgICAgJHtsaW5lMn1vTU1vICAgICAgICAuTU0vICAgICAgICAgIC55bWh5c28rOmhNcyAgIDpNTS8gLU5NLyAgOk1Nc29vb29vb29vbysgIG1NK1xuICBNTU1NTXkuICAgICAgICAgICAgICAgIG9NTW8gICAgICAgIC5NTS8gICAgICAgICAgZE15JyAgICAnZE1zICAgICtNTjptTSsgICAnTk1vICAgICAgICAgICAgbU0rXG4gIE1NTU1NTU55OicgICAgICAgICAgICAgb01NbyAgICAgICAgLk1NeSsrKysrKysrOiBzTW0vLS0tL2ROTXMgICAgIHlNTU1zICAgICAtZE1kKzotOi9zbXknICBtTStcbiAgTk1NTU1NTU1NbXkrOi0uJyAgICAgICd5TU0vICAgICAgICAneXl5eXl5eXl5eXlvICA6c2hoaHlzOit5LyAgICAgLk1NaCAgICAgICAnLW95aGhoeXM6JyAgIHN5OlxuICA6ZE1NTU1NTU1NTU1NTU5OTk5OTk5OTk1OcyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBoTWQnXG4gICAtLysrKysrKysrKysrKysrKysrKys6JyAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgc05tZG8nYDtcbiB9XG4iXX0=
