'use strict';

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The MessagePart class represents an element of a message.
 *
 *      // Create a Message Part with any mimeType
 *      var part = new layer.MessagePart({
 *          body: "hello",
 *          mimeType: "text/plain"
 *      });
 *
 *      // Create a text/plain only Message Part
 *      var part = new layer.MessagePart("Hello I am text/plain");
 *
 * You can also create a Message Part from a File Input dom node:
 *
 *      var fileInputNode = document.getElementById("myFileInput");
 *      var part = new layer.MessagePart(fileInputNode.files[0]);
 *
 * You can also create Message Parts from a file drag and drop operation:
 *
 *      onFileDrop: function(evt) {
 *           var files = evt.dataTransfer.files;
 *           var m = conversation.createMessage({
 *               parts: files.map(function(file) {
 *                  return new layer.MessagePart({body: file, mimeType: file.type});
 *               }
 *           });
 *      });
 *
 * ### Blobs vs Strings
 *
 * You should always expect to see the `body` property be a Blob **unless** the mimeType is listed in layer.MessagePart.TextualMimeTypes,
 * in which case the value will be a String.  You can add mimeTypes to TextualMimeTypes:
 *
 * ```
 * layer.MessagePart.TextualMimeTypes = ['text/plain', 'text/mountain', /^application\/json(\+.+)$/]
 * ```
 *
 * Any mimeType matching the above strings and regular expressions will be transformed to text before being delivered to your app; otherwise it must be a Blob.
 *
 * ### Accesing Rich Content
 *
 * There are two ways of accessing rich content
 *
 * 1. Access the data directly: `part.fetchContent(function(data) {myRenderData(data);})`. This approach downloads the data,
 *    writes it to the the `body` property, writes a Data URI to the part's `url` property, and then calls your callback.
 *    By downloading the data and storing it in `body`, the data does not expire.
 * 2. Access the URL rather than the data.  When you first receive the Message Part it will have a valid `url` property; however, this URL expires.  *    URLs are needed for streaming, and for content that doesn't yet need to be rendered (e.g. hyperlinks to data that will render when clicked).
 *    The url property will return a string if the url is valid, or '' if its expired.  Call `part.fetchStream(callback)` to get an updated URL.
 *    The following pattern is recommended:
 *
 * ```
 * if (!part.url) {
 *   part.fetchStream(function(url) {myRenderUrl(url)});
 * } else {
 *   myRenderUrl(part.url);
 * }
 * ```
 *
 * NOTE: `layer.MessagePart.url` should have a value when the message is first received, and will only fail `if (!part.url)` once the url has expired.
 *
 * @class  layer.MessagePart
 * @extends layer.Root
 * @author Michael Kantor
 */

var Root = require('./root');
var Content = require('./content');
var xhr = require('./xhr');
var ClientRegistry = require('./client-registry');
var LayerError = require('./layer-error');
var Util = require('./client-utils');
var logger = require('./logger');

var MessagePart = function (_Root) {
  _inherits(MessagePart, _Root);

  /**
   * Constructor
   *
   * @method constructor
   * @param  {Object} options - Can be an object with body and mimeType, or it can be a string, or a Blob/File
   * @param  {string} options.body - Any string larger than 2kb will be sent as Rich Content, meaning it will be uploaded to cloud storage and must be separately downloaded from the Message when its received.
   * @param  {string} [options.mimeType=text/plain] - Mime type; can be anything; if your client doesn't have a renderer for it, it will be ignored.
   * @param  {number} [options.size=0] - Size of your part. Will be calculated for you if not provided.
   *
   * @return {layer.MessagePart}
   */
  function MessagePart(options) {
    _classCallCheck(this, MessagePart);

    var newOptions = options;
    if (typeof options === 'string') {
      newOptions = { body: options };
      if ((arguments.length <= 1 ? 0 : arguments.length - 1) > 0) {
        newOptions.mimeType = arguments.length <= 1 ? undefined : arguments[1];
      } else {
        newOptions.mimeType = 'text/plain';
      }
    } else if (Util.isBlob(options) || Util.isBlob(options.body)) {
      var body = options instanceof Blob ? options : options.body;
      var mimeType = Util.isBlob(options.body) ? options.mimeType : body.type;
      newOptions = {
        mimeType: mimeType,
        body: body,
        size: body.size,
        hasContent: true
      };
    }

    var _this = _possibleConstructorReturn(this, (MessagePart.__proto__ || Object.getPrototypeOf(MessagePart)).call(this, newOptions));

    if (!_this.size && _this.body) _this.size = _this.body.length;

    // Don't expose encoding; blobify it if its encoded.
    if (options.encoding === 'base64') {
      _this.body = Util.base64ToBlob(_this.body);
    }

    // Could be a blob because it was read out of indexedDB,
    // or because it was created locally with a file
    // Or because of base64 encoded data.
    var isBlobBody = Util.isBlob(_this.body);
    var textual = _this.isTextualMimeType();

    // Custom handling for non-textual content
    if (!textual) {
      // If the body exists and is a blob, extract the data uri for convenience; only really relevant for image and video HTML tags.
      if (!isBlobBody && _this.body) _this.body = new Blob([_this.body], { type: _this.mimeType });
      if (_this.body) _this.url = URL.createObjectURL(_this.body);
    }

    // If our textual content is a blob, turning it into text is asychronous, and can't be done in the synchronous constructor
    // This will only happen when the client is attaching a file.  Conversion for locally created messages is done while calling `Message.send()`
    return _this;
  }

  _createClass(MessagePart, [{
    key: 'destroy',
    value: function destroy() {
      if (this.__url) {
        URL.revokeObjectURL(this.__url);
        this.__url = null;
      }
      this.body = null;
      _get(MessagePart.prototype.__proto__ || Object.getPrototypeOf(MessagePart.prototype), 'destroy', this).call(this);
    }

    /**
     * Get the layer.Client associated with this layer.MessagePart.
     *
     * Uses the layer.MessagePart.clientId property.
     *
     * @method _getClient
     * @private
     * @return {layer.Client}
     */

  }, {
    key: '_getClient',
    value: function _getClient() {
      return ClientRegistry.get(this.clientId);
    }

    /**
     * Get the layer.Message associated with this layer.MessagePart.
     *
     * @method _getMessage
     * @private
     * @return {layer.Message}
     */

  }, {
    key: '_getMessage',
    value: function _getMessage() {
      return this._getClient().getMessage(this.id.replace(/\/parts.*$/, ''));
    }

    /**
     * Download Rich Content from cloud server.
     *
     * For MessageParts with rich content, this method will load the data from google's cloud storage.
     * The body property of this MessagePart is set to the result.
     *
     *      messagepart.fetchContent()
     *      .on("content-loaded", function() {
     *          render(messagepart.body);
     *      });
     *
     * Note that a successful call to `fetchContent` will also cause Query change events to fire.
     * In this example, `render` will be called by the query change event that will occur once the content has downloaded:
     *
     * ```
     *  query.on('change', function(evt) {
     *    render(query.data);
     *  });
     *  messagepart.fetchContent();
     * ```
     *
     *
     * @method fetchContent
     * @param {Function} [callback]
     * @param {Mixed} callback.data - Either a string (mimeType=text/plain) or a Blob (all other mimeTypes)
     * @return {layer.Content} this
     */

  }, {
    key: 'fetchContent',
    value: function fetchContent(callback) {
      var _this2 = this;

      if (this._content && !this.isFiring) {
        this.isFiring = true;
        var type = this.mimeType === 'image/jpeg+preview' ? 'image/jpeg' : this.mimeType;
        this._content.loadContent(type, function (err, result) {
          return _this2._fetchContentCallback(err, result, callback);
        });
      }
      return this;
    }

    /**
     * Callback with result or error from calling fetchContent.
     *
     * @private
     * @method _fetchContentCallback
     * @param {layer.LayerError} err
     * @param {Object} result
     * @param {Function} callback
     */

  }, {
    key: '_fetchContentCallback',
    value: function _fetchContentCallback(err, result, callback) {
      var _this3 = this;

      if (err) {
        this.trigger('content-loaded-error', err);
      } else {
        this.isFiring = false;
        if (this.isTextualMimeType()) {
          Util.fetchTextFromFile(result, function (text) {
            return _this3._fetchContentComplete(text, callback);
          });
        } else {
          this.url = URL.createObjectURL(result);
          this._fetchContentComplete(result, callback);
        }
      }
    }

    /**
     * Callback with Part Body from _fetchContentCallback.
     *
     * @private
     * @method _fetchContentComplete
     * @param {Blob|String} body
     * @param {Function} callback
     */

  }, {
    key: '_fetchContentComplete',
    value: function _fetchContentComplete(body, callback) {
      var message = this._getMessage();

      this.body = body;

      this.trigger('content-loaded');
      message._triggerAsync('messages:change', {
        oldValue: message.parts,
        newValue: message.parts,
        property: 'parts'
      });
      if (callback) callback(this.body);
    }

    /**
     * Access the URL to the remote resource.
     *
     * Useful for streaming the content so that you don't have to download the entire file before rendering it.
     * Also useful for content that will be openned in a new window, and does not need to be fetched now.
     *
     * For MessageParts with Rich Content, will lookup a URL to your Rich Content.
     * Useful for streaming and content so that you don't have to download the entire file before rendering it.
     *
     * ```
     * messagepart.fetchStream(function(url) {
     *     render(url);
     * });
     * ```
     *
     * Note that a successful call to `fetchStream` will also cause Query change events to fire.
     * In this example, `render` will be called by the query change event that will occur once the `url` has been refreshed:
     *
     * ```
     *  query.on('change', function(evt) {
     *      render(query.data);
     *  });
     *  messagepart.fetchStream();
     * ```
     *
     * @method fetchStream
     * @param {Function} [callback]
     * @param {Mixed} callback.url
     * @return {layer.Content} this
     */

  }, {
    key: 'fetchStream',
    value: function fetchStream(callback) {
      var _this4 = this;

      if (!this._content) throw new Error(LayerError.dictionary.contentRequired);
      if (this._content.isExpired()) {
        this._content.refreshContent(this._getClient(), function (url) {
          return _this4._fetchStreamComplete(url, callback);
        });
      } else {
        this._fetchStreamComplete(this._content.downloadUrl, callback);
      }
      return this;
    }

    // Does not set this.url; instead relies on fact that this._content.downloadUrl has been updated

  }, {
    key: '_fetchStreamComplete',
    value: function _fetchStreamComplete(url, callback) {
      var message = this._getMessage();

      this.trigger('url-loaded');
      message._triggerAsync('messages:change', {
        oldValue: message.parts,
        newValue: message.parts,
        property: 'parts'
      });
      if (callback) callback(url);
    }

    /**
     * Preps a MessagePart for sending.  Normally that is trivial.
     * But if there is rich content, then the content must be uploaded
     * and then we can trigger a "parts:send" event indicating that
     * the part is ready to send.
     *
     * @method _send
     * @protected
     * @param  {layer.Client} client
     * @fires parts:send
     */

  }, {
    key: '_sendPart',
    value: function _sendPart(client) {
      // There is already a Content object, presumably the developer
      // already took care of this step for us.
      if (this._content) {
        this._sendWithContent();
      }

      // If the size is large, Create and upload the Content
      else if (this.size > 2048) {
          this._generateContentAndSend(client);
        }

        // If the body is a blob, but is not YET Rich Content, do some custom analysis/processing:
        else if (Util.isBlob(this.body)) {
            this._sendBlob(client);
          }

          // Else the message part can be sent as is.
          else {
              this._sendBody();
            }
    }
  }, {
    key: '_send',
    value: function _send(client) {
      var _this5 = this;

      if (typeof this.lazyResolve === 'function') {
        this.lazyResolve(this, function (result) {
          Object.assign(_this5, result);
          _this5._sendPart(client);
        });
      } else {
        this._sendPart(client);
      }
    }
  }, {
    key: '_sendBody',
    value: function _sendBody() {
      if (typeof this.body !== 'string') {
        var err = 'MessagePart.body must be a string in order to send it';
        logger.error(err, { mimeType: this.mimeType, body: this.body });
        throw new Error(err);
      }

      var obj = {
        mime_type: this.mimeType,
        body: this.body
      };
      this.trigger('parts:send', obj);
    }
  }, {
    key: '_sendWithContent',
    value: function _sendWithContent() {
      this.trigger('parts:send', {
        mime_type: this.mimeType,
        content: {
          size: this.size,
          id: this._content.id
        }
      });
    }

    /**
     * This method is only called if Blob.size < 2048.
     *
     * However, conversion to base64 can impact the size, so we must retest the size
     * after conversion, and then decide to send the original blob or the base64 encoded data.
     *
     * @method _sendBlob
     * @private
     * @param {layer.Client} client
     */

  }, {
    key: '_sendBlob',
    value: function _sendBlob(client) {
      var _this6 = this;

      /* istanbul ignore else */
      Util.blobToBase64(this.body, function (base64data) {
        if (base64data.length < 2048) {
          var body = base64data.substring(base64data.indexOf(',') + 1);
          var obj = {
            body: body,
            mime_type: _this6.mimeType
          };
          obj.encoding = 'base64';
          _this6.trigger('parts:send', obj);
        } else {
          _this6._generateContentAndSend(client);
        }
      });
    }

    /**
     * Create an rich Content object on the server
     * and then call _processContentResponse
     *
     * @method _generateContentAndSend
     * @private
     * @param  {layer.Client} client
     */

  }, {
    key: '_generateContentAndSend',
    value: function _generateContentAndSend(client) {
      var _this7 = this;

      this.hasContent = true;
      var body = void 0;
      if (!Util.isBlob(this.body)) {
        body = Util.base64ToBlob(Util.utoa(this.body), this.mimeType);
      } else {
        body = this.body;
      }
      client.xhr({
        url: '/content',
        method: 'POST',
        headers: {
          'Upload-Content-Type': this.mimeType,
          'Upload-Content-Length': body.size,
          'Upload-Origin': typeof location !== 'undefined' ? location.origin : ''
        },
        sync: {}
      }, function (result) {
        _this7._processContentResponse(result.data, body, client);
      });
    }

    /**
     * Creates a layer.Content object from the server's
     * Content object, and then uploads the data to google cloud storage.
     *
     * @method _processContentResponse
     * @private
     * @param  {Object} response
     * @param  {Blob} body
     * @param  {layer.Client} client
     */

  }, {
    key: '_processContentResponse',
    value: function _processContentResponse(response, body, client) {
      var _this8 = this;

      this._content = new Content(response.id);
      this.hasContent = true;

      xhr({
        url: response.upload_url,
        method: 'PUT',
        data: body,
        headers: {
          'Upload-Content-Length': this.size,
          'Upload-Content-Type': this.mimeType
        }
      }, function (result) {
        return _this8._processContentUploadResponse(result, response, client);
      });
    }
  }, {
    key: '_processContentUploadResponse',
    value: function _processContentUploadResponse(uploadResult, contentResponse, client) {
      if (!uploadResult.success) {
        if (!client.onlineManager.isOnline) {
          client.onlineManager.once('connected', this._processContentResponse.bind(this, contentResponse, client), this);
        } else {
          logger.error('We don\'t yet handle this!');
        }
      } else {
        this.trigger('parts:send', {
          mime_type: this.mimeType,
          content: {
            size: this.size,
            id: this._content.id
          }
        });
      }
    }

    /**
     * Returns the text for any text/plain part.
     *
     * Returns '' if its not a text/plain part.
     *
     * @method getText
     * @return {string}
     */

  }, {
    key: 'getText',
    value: function getText() {
      if (this.isTextualMimeType()) {
        return this.body;
      } else {
        return '';
      }
    }

    /**
     * Updates the MessagePart with new data from the server.
     *
     * Currently, MessagePart properties do not update... however,
     * the layer.Content object that Rich Content MessageParts contain
     * do get updated with refreshed expiring urls.
     *
     * @method _populateFromServer
     * @param  {Object} part - Server representation of a part
     * @private
     */

  }, {
    key: '_populateFromServer',
    value: function _populateFromServer(part) {
      if (part.content && this._content) {
        this._content.downloadUrl = part.content.download_url;
        this._content.expiration = new Date(part.content.expiration);
      }
    }

    /**
     * Is the mimeType for this MessagePart defined as textual content?
     *
     * If the answer is true, expect a `body` of string, else expect `body` of Blob.
     *
     * To change whether a given MIME Type is treated as textual, see layer.MessagePart.TextualMimeTypes.
     *
     * @method isTextualMimeType
     * @returns {Boolean}
     */

  }, {
    key: 'isTextualMimeType',
    value: function isTextualMimeType() {
      var i = 0;
      for (i = 0; i < MessagePart.TextualMimeTypes.length; i++) {
        var test = MessagePart.TextualMimeTypes[i];
        if (typeof test === 'string') {
          if (test === this.mimeType) return true;
        } else if (test instanceof RegExp) {
          if (this.mimeType.match(test)) return true;
        }
      }
      return false;
    }

    /**
     * Creates a MessagePart from a server representation of the part
     *
     * @method _createFromServer
     * @private
     * @static
     * @param  {Object} part - Server representation of a part
     */

  }], [{
    key: '_createFromServer',
    value: function _createFromServer(part) {
      var content = part.content ? Content._createFromServer(part.content) : null;

      // Turn base64 data into a Blob
      if (part.encoding === 'base64') part.body = Util.base64ToBlob(part.body, part.mimeType);

      // Create the MessagePart
      return new MessagePart({
        id: part.id,
        mimeType: part.mime_type,
        body: part.body || '',
        _content: content,
        hasContent: Boolean(content),
        size: part.size || 0
      });
    }
  }]);

  return MessagePart;
}(Root);

/**
 * layer.Client that the conversation belongs to.
 *
 * Actual value of this string matches the appId.
 * @type {string}
 */


MessagePart.prototype.clientId = '';

/**
 * Server generated identifier for the part
 * @type {string}
 */
MessagePart.prototype.id = '';

/**
 * Allow lazy resolve message part fields (body, size, content, etc)
 *
 * @type {function}
 */
MessagePart.prototype.lazyResolve = null;

/**
 * Body of your message part.
 *
 * This is the core data of your part.
 *
 * If this is `null` then most likely layer.Message.hasContent is true, and you
 * can either use the layer.MessagePart.url property or the layer.MessagePart.fetchContent method.
 *
 * @type {string}
 */
MessagePart.prototype.body = null;

/**
 * Rich content object.
 *
 * This will be automatically created for you if your layer.MessagePart.body
 * is large.
 * @type {layer.Content}
 * @private
 */
MessagePart.prototype._content = null;

/**
 * The Part has rich content
 * @type {Boolean}
 */
MessagePart.prototype.hasContent = false;

/**
 * URL to rich content object.
 *
 * Parts with rich content will be initialized with this property set.  But its value will expire.
 *
 * Will contain an expiring url at initialization time and be refreshed with calls to `layer.MessagePart.fetchStream()`.
 * Will contain a non-expiring url to a local resource if `layer.MessagePart.fetchContent()` is called.
 *
 * @type {layer.Content}
 */
Object.defineProperty(MessagePart.prototype, 'url', {
  enumerable: true,
  get: function get() {
    // Its possible to have a url and no content if it has been instantiated but not yet sent.
    // If there is a __url then its a local url generated from the body property and does not expire.
    if (this.__url) return this.__url;
    if (this._content) return this._content.isExpired() ? '' : this._content.downloadUrl;
    return '';
  },
  set: function set(inValue) {
    this.__url = inValue;
  }
});

/**
 * Mime Type for the data represented by the MessagePart.
 *
 * Typically this is the type for the data in layer.MessagePart.body;
 * if there is Rich Content, then its the type of Content that needs to be
 * downloaded.
 *
 * @type {String}
 */
MessagePart.prototype.mimeType = 'text/plain';

/**
 * Size of the layer.MessagePart.body.
 *
 * Will be set for you if not provided.
 * Only needed for use with rich content.
 *
 * @type {number}
 */
MessagePart.prototype.size = 0;

/**
 * Array of mime types that should be treated as text.
 *
 * Treating a MessagePart as text means that even if the `body` gets a File or Blob,
 * it will be transformed to a string before being delivered to your app.
 *
 * This value can be customized using strings and regular expressions:
 *
 * ```
 * layer.MessagePart.TextualMimeTypes = ['text/plain', 'text/mountain', /^application\/json(\+.+)$/]
 * ```
 *
 * @static
 * @type {Mixed[]}
 */
MessagePart.TextualMimeTypes = [/^text\/.+$/, /^application\/json(\+.+)?$/];

MessagePart._supportedEvents = ['parts:send', 'content-loaded', 'url-loaded', 'content-loaded-error'].concat(Root._supportedEvents);
Root.initClass.apply(MessagePart, [MessagePart, 'MessagePart']);

module.exports = MessagePart;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tZXNzYWdlLXBhcnQuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJDb250ZW50IiwieGhyIiwiQ2xpZW50UmVnaXN0cnkiLCJMYXllckVycm9yIiwiVXRpbCIsImxvZ2dlciIsIk1lc3NhZ2VQYXJ0Iiwib3B0aW9ucyIsIm5ld09wdGlvbnMiLCJib2R5IiwibWltZVR5cGUiLCJpc0Jsb2IiLCJCbG9iIiwidHlwZSIsInNpemUiLCJoYXNDb250ZW50IiwibGVuZ3RoIiwiZW5jb2RpbmciLCJiYXNlNjRUb0Jsb2IiLCJpc0Jsb2JCb2R5IiwidGV4dHVhbCIsImlzVGV4dHVhbE1pbWVUeXBlIiwidXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiX191cmwiLCJyZXZva2VPYmplY3RVUkwiLCJnZXQiLCJjbGllbnRJZCIsIl9nZXRDbGllbnQiLCJnZXRNZXNzYWdlIiwiaWQiLCJyZXBsYWNlIiwiY2FsbGJhY2siLCJfY29udGVudCIsImlzRmlyaW5nIiwibG9hZENvbnRlbnQiLCJlcnIiLCJyZXN1bHQiLCJfZmV0Y2hDb250ZW50Q2FsbGJhY2siLCJ0cmlnZ2VyIiwiZmV0Y2hUZXh0RnJvbUZpbGUiLCJfZmV0Y2hDb250ZW50Q29tcGxldGUiLCJ0ZXh0IiwibWVzc2FnZSIsIl9nZXRNZXNzYWdlIiwiX3RyaWdnZXJBc3luYyIsIm9sZFZhbHVlIiwicGFydHMiLCJuZXdWYWx1ZSIsInByb3BlcnR5IiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY29udGVudFJlcXVpcmVkIiwiaXNFeHBpcmVkIiwicmVmcmVzaENvbnRlbnQiLCJfZmV0Y2hTdHJlYW1Db21wbGV0ZSIsImRvd25sb2FkVXJsIiwiY2xpZW50IiwiX3NlbmRXaXRoQ29udGVudCIsIl9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kIiwiX3NlbmRCbG9iIiwiX3NlbmRCb2R5IiwibGF6eVJlc29sdmUiLCJPYmplY3QiLCJhc3NpZ24iLCJfc2VuZFBhcnQiLCJlcnJvciIsIm9iaiIsIm1pbWVfdHlwZSIsImNvbnRlbnQiLCJibG9iVG9CYXNlNjQiLCJiYXNlNjRkYXRhIiwic3Vic3RyaW5nIiwiaW5kZXhPZiIsInV0b2EiLCJtZXRob2QiLCJoZWFkZXJzIiwibG9jYXRpb24iLCJvcmlnaW4iLCJzeW5jIiwiX3Byb2Nlc3NDb250ZW50UmVzcG9uc2UiLCJkYXRhIiwicmVzcG9uc2UiLCJ1cGxvYWRfdXJsIiwiX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2UiLCJ1cGxvYWRSZXN1bHQiLCJjb250ZW50UmVzcG9uc2UiLCJzdWNjZXNzIiwib25saW5lTWFuYWdlciIsImlzT25saW5lIiwib25jZSIsImJpbmQiLCJwYXJ0IiwiZG93bmxvYWRfdXJsIiwiZXhwaXJhdGlvbiIsIkRhdGUiLCJpIiwiVGV4dHVhbE1pbWVUeXBlcyIsInRlc3QiLCJSZWdFeHAiLCJtYXRjaCIsIl9jcmVhdGVGcm9tU2VydmVyIiwiQm9vbGVhbiIsInByb3RvdHlwZSIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSIsInNldCIsImluVmFsdWUiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpRUEsSUFBTUEsT0FBT0MsUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNQyxVQUFVRCxRQUFRLFdBQVIsQ0FBaEI7QUFDQSxJQUFNRSxNQUFNRixRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQU1HLGlCQUFpQkgsUUFBUSxtQkFBUixDQUF2QjtBQUNBLElBQU1JLGFBQWFKLFFBQVEsZUFBUixDQUFuQjtBQUNBLElBQU1LLE9BQU9MLFFBQVEsZ0JBQVIsQ0FBYjtBQUNBLElBQU1NLFNBQVNOLFFBQVEsVUFBUixDQUFmOztJQUVNTyxXOzs7QUFFSjs7Ozs7Ozs7Ozs7QUFXQSx1QkFB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bkYsS0FBTCxHQUFhbUYsT0FBYjtBQUNEO0FBWGlELENBQXBEOztBQWNBOzs7Ozs7Ozs7QUFTQXRHLFlBQVlrRyxTQUFaLENBQXNCOUYsUUFBdEIsR0FBaUMsWUFBakM7O0FBRUE7Ozs7Ozs7O0FBUUFKLFlBQVlrRyxTQUFaLENBQXNCMUYsSUFBdEIsR0FBNkIsQ0FBN0I7O0FBRUE7Ozs7Ozs7Ozs7Ozs7OztBQWVBUixZQUFZNEYsZ0JBQVosR0FBK0IsQ0FBQyxZQUFELEVBQWUsNEJBQWYsQ0FBL0I7O0FBRUE1RixZQUFZdUcsZ0JBQVosR0FBK0IsQ0FDN0IsWUFENkIsRUFFN0IsZ0JBRjZCLEVBRzdCLFlBSDZCLEVBSTdCLHNCQUo2QixFQUs3QkMsTUFMNkIsQ0FLdEJoSCxLQUFLK0csZ0JBTGlCLENBQS9CO0FBTUEvRyxLQUFLaUgsU0FBTCxDQUFlQyxLQUFmLENBQXFCMUcsV0FBckIsRUFBa0MsQ0FBQ0EsV0FBRCxFQUFjLGFBQWQsQ0FBbEM7O0FBRUEyRyxPQUFPQyxPQUFQLEdBQWlCNUcsV0FBakIiLCJmaWxlIjoibWVzc2FnZS1wYXJ0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBUaGUgTWVzc2FnZVBhcnQgY2xhc3MgcmVwcmVzZW50cyBhbiBlbGVtZW50IG9mIGEgbWVzc2FnZS5cbiAqXG4gKiAgICAgIC8vIENyZWF0ZSBhIE1lc3NhZ2UgUGFydCB3aXRoIGFueSBtaW1lVHlwZVxuICogICAgICB2YXIgcGFydCA9IG5ldyBsYXllci5NZXNzYWdlUGFydCh7XG4gKiAgICAgICAgICBib2R5OiBcImhlbGxvXCIsXG4gKiAgICAgICAgICBtaW1lVHlwZTogXCJ0ZXh0L3BsYWluXCJcbiAqICAgICAgfSk7XG4gKlxuICogICAgICAvLyBDcmVhdGUgYSB0ZXh0L3BsYWluIG9ubHkgTWVzc2FnZSBQYXJ0XG4gKiAgICAgIHZhciBwYXJ0ID0gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KFwiSGVsbG8gSSBhbSB0ZXh0L3BsYWluXCIpO1xuICpcbiAqIFlvdSBjYW4gYWxzbyBjcmVhdGUgYSBNZXNzYWdlIFBhcnQgZnJvbSBhIEZpbGUgSW5wdXQgZG9tIG5vZGU6XG4gKlxuICogICAgICB2YXIgZmlsZUlucHV0Tm9kZSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFwibXlGaWxlSW5wdXRcIik7XG4gKiAgICAgIHZhciBwYXJ0ID0gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KGZpbGVJbnB1dE5vZGUuZmlsZXNbMF0pO1xuICpcbiAqIFlvdSBjYW4gYWxzbyBjcmVhdGUgTWVzc2FnZSBQYXJ0cyBmcm9tIGEgZmlsZSBkcmFnIGFuZCBkcm9wIG9wZXJhdGlvbjpcbiAqXG4gKiAgICAgIG9uRmlsZURyb3A6IGZ1bmN0aW9uKGV2dCkge1xuICogICAgICAgICAgIHZhciBmaWxlcyA9IGV2dC5kYXRhVHJhbnNmZXIuZmlsZXM7XG4gKiAgICAgICAgICAgdmFyIG0gPSBjb252ZXJzYXRpb24uY3JlYXRlTWVzc2FnZSh7XG4gKiAgICAgICAgICAgICAgIHBhcnRzOiBmaWxlcy5tYXAoZnVuY3Rpb24oZmlsZSkge1xuICogICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IGxheWVyLk1lc3NhZ2VQYXJ0KHtib2R5OiBmaWxlLCBtaW1lVHlwZTogZmlsZS50eXBlfSk7XG4gKiAgICAgICAgICAgICAgIH1cbiAqICAgICAgICAgICB9KTtcbiAqICAgICAgfSk7XG4gKlxuICogIyMjIEJsb2JzIHZzIFN0cmluZ3NcbiAqXG4gKiBZb3Ugc2hvdWxkIGFsd2F5cyBleHBlY3QgdG8gc2VlIHRoZSBgYm9keWAgcHJvcGVydHkgYmUgYSBCbG9iICoqdW5sZXNzKiogdGhlIG1pbWVUeXBlIGlzIGxpc3RlZCBpbiBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLFxuICogaW4gd2hpY2ggY2FzZSB0aGUgdmFsdWUgd2lsbCBiZSBhIFN0cmluZy4gIFlvdSBjYW4gYWRkIG1pbWVUeXBlcyB0byBUZXh0dWFsTWltZVR5cGVzOlxuICpcbiAqIGBgYFxuICogbGF5ZXIuTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlcyA9IFsndGV4dC9wbGFpbicsICd0ZXh0L21vdW50YWluJywgL15hcHBsaWNhdGlvblxcL2pzb24oXFwrLispJC9dXG4gKiBgYGBcbiAqXG4gKiBBbnkgbWltZVR5cGUgbWF0Y2hpbmcgdGhlIGFib3ZlIHN0cmluZ3MgYW5kIHJlZ3VsYXIgZXhwcmVzc2lvbnMgd2lsbCBiZSB0cmFuc2Zvcm1lZCB0byB0ZXh0IGJlZm9yZSBiZWluZyBkZWxpdmVyZWQgdG8geW91ciBhcHA7IG90aGVyd2lzZSBpdCBtdXN0IGJlIGEgQmxvYi5cbiAqXG4gKiAjIyMgQWNjZXNpbmcgUmljaCBDb250ZW50XG4gKlxuICogVGhlcmUgYXJlIHR3byB3YXlzIG9mIGFjY2Vzc2luZyByaWNoIGNvbnRlbnRcbiAqXG4gKiAxLiBBY2Nlc3MgdGhlIGRhdGEgZGlyZWN0bHk6IGBwYXJ0LmZldGNoQ29udGVudChmdW5jdGlvbihkYXRhKSB7bXlSZW5kZXJEYXRhKGRhdGEpO30pYC4gVGhpcyBhcHByb2FjaCBkb3dubG9hZHMgdGhlIGRhdGEsXG4gKiAgICB3cml0ZXMgaXQgdG8gdGhlIHRoZSBgYm9keWAgcHJvcGVydHksIHdyaXRlcyBhIERhdGEgVVJJIHRvIHRoZSBwYXJ0J3MgYHVybGAgcHJvcGVydHksIGFuZCB0aGVuIGNhbGxzIHlvdXIgY2FsbGJhY2suXG4gKiAgICBCeSBkb3dubG9hZGluZyB0aGUgZGF0YSBhbmQgc3RvcmluZyBpdCBpbiBgYm9keWAsIHRoZSBkYXRhIGRvZXMgbm90IGV4cGlyZS5cbiAqIDIuIEFjY2VzcyB0aGUgVVJMIHJhdGhlciB0aGFuIHRoZSBkYXRhLiAgV2hlbiB5b3UgZmlyc3QgcmVjZWl2ZSB0aGUgTWVzc2FnZSBQYXJ0IGl0IHdpbGwgaGF2ZSBhIHZhbGlkIGB1cmxgIHByb3BlcnR5OyBob3dldmVyLCB0aGlzIFVSTCBleHBpcmVzLiAgKiAgICBVUkxzIGFyZSBuZWVkZWQgZm9yIHN0cmVhbWluZywgYW5kIGZvciBjb250ZW50IHRoYXQgZG9lc24ndCB5ZXQgbmVlZCB0byBiZSByZW5kZXJlZCAoZS5nLiBoeXBlcmxpbmtzIHRvIGRhdGEgdGhhdCB3aWxsIHJlbmRlciB3aGVuIGNsaWNrZWQpLlxuICogICAgVGhlIHVybCBwcm9wZXJ0eSB3aWxsIHJldHVybiBhIHN0cmluZyBpZiB0aGUgdXJsIGlzIHZhbGlkLCBvciAnJyBpZiBpdHMgZXhwaXJlZC4gIENhbGwgYHBhcnQuZmV0Y2hTdHJlYW0oY2FsbGJhY2spYCB0byBnZXQgYW4gdXBkYXRlZCBVUkwuXG4gKiAgICBUaGUgZm9sbG93aW5nIHBhdHRlcm4gaXMgcmVjb21tZW5kZWQ6XG4gKlxuICogYGBgXG4gKiBpZiAoIXBhcnQudXJsKSB7XG4gKiAgIHBhcnQuZmV0Y2hTdHJlYW0oZnVuY3Rpb24odXJsKSB7bXlSZW5kZXJVcmwodXJsKX0pO1xuICogfSBlbHNlIHtcbiAqICAgbXlSZW5kZXJVcmwocGFydC51cmwpO1xuICogfVxuICogYGBgXG4gKlxuICogTk9URTogYGxheWVyLk1lc3NhZ2VQYXJ0LnVybGAgc2hvdWxkIGhhdmUgYSB2YWx1ZSB3aGVuIHRoZSBtZXNzYWdlIGlzIGZpcnN0IHJlY2VpdmVkLCBhbmQgd2lsbCBvbmx5IGZhaWwgYGlmICghcGFydC51cmwpYCBvbmNlIHRoZSB1cmwgaGFzIGV4cGlyZWQuXG4gKlxuICogQGNsYXNzICBsYXllci5NZXNzYWdlUGFydFxuICogQGV4dGVuZHMgbGF5ZXIuUm9vdFxuICogQGF1dGhvciBNaWNoYWVsIEthbnRvclxuICovXG5cbmNvbnN0IFJvb3QgPSByZXF1aXJlKCcuL3Jvb3QnKTtcbmNvbnN0IENvbnRlbnQgPSByZXF1aXJlKCcuL2NvbnRlbnQnKTtcbmNvbnN0IHhociA9IHJlcXVpcmUoJy4veGhyJyk7XG5jb25zdCBDbGllbnRSZWdpc3RyeSA9IHJlcXVpcmUoJy4vY2xpZW50LXJlZ2lzdHJ5Jyk7XG5jb25zdCBMYXllckVycm9yID0gcmVxdWlyZSgnLi9sYXllci1lcnJvcicpO1xuY29uc3QgVXRpbCA9IHJlcXVpcmUoJy4vY2xpZW50LXV0aWxzJyk7XG5jb25zdCBsb2dnZXIgPSByZXF1aXJlKCcuL2xvZ2dlcicpO1xuXG5jbGFzcyBNZXNzYWdlUGFydCBleHRlbmRzIFJvb3Qge1xuXG4gIC8qKlxuICAgKiBDb25zdHJ1Y3RvclxuICAgKlxuICAgKiBAbWV0aG9kIGNvbnN0cnVjdG9yXG4gICAqIEBwYXJhbSAge09iamVjdH0gb3B0aW9ucyAtIENhbiBiZSBhbiBvYmplY3Qgd2l0aCBib2R5IGFuZCBtaW1lVHlwZSwgb3IgaXQgY2FuIGJlIGEgc3RyaW5nLCBvciBhIEJsb2IvRmlsZVxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IG9wdGlvbnMuYm9keSAtIEFueSBzdHJpbmcgbGFyZ2VyIHRoYW4gMmtiIHdpbGwgYmUgc2VudCBhcyBSaWNoIENvbnRlbnQsIG1lYW5pbmcgaXQgd2lsbCBiZSB1cGxvYWRlZCB0byBjbG91ZCBzdG9yYWdlIGFuZCBtdXN0IGJlIHNlcGFyYXRlbHkgZG93bmxvYWRlZCBmcm9tIHRoZSBNZXNzYWdlIHdoZW4gaXRzIHJlY2VpdmVkLlxuICAgKiBAcGFyYW0gIHtzdHJpbmd9IFtvcHRpb25zLm1pbWVUeXBlPXRleHQvcGxhaW5dIC0gTWltZSB0eXBlOyBjYW4gYmUgYW55dGhpbmc7IGlmIHlvdXIgY2xpZW50IGRvZXNuJ3QgaGF2ZSBhIHJlbmRlcmVyIGZvciBpdCwgaXQgd2lsbCBiZSBpZ25vcmVkLlxuICAgKiBAcGFyYW0gIHtudW1iZXJ9IFtvcHRpb25zLnNpemU9MF0gLSBTaXplIG9mIHlvdXIgcGFydC4gV2lsbCBiZSBjYWxjdWxhdGVkIGZvciB5b3UgaWYgbm90IHByb3ZpZGVkLlxuICAgKlxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlUGFydH1cbiAgICovXG4gIGNvbnN0cnVjdG9yKG9wdGlvbnMsIC4uLmFyZ3MpIHtcbiAgICBsZXQgbmV3T3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgaWYgKHR5cGVvZiBvcHRpb25zID09PSAnc3RyaW5nJykge1xuICAgICAgbmV3T3B0aW9ucyA9IHsgYm9keTogb3B0aW9ucyB9O1xuICAgICAgaWYgKGFyZ3MubGVuZ3RoID4gMCkge1xuICAgICAgICBuZXdPcHRpb25zLm1pbWVUeXBlID0gYXJnc1swXTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIG5ld09wdGlvbnMubWltZVR5cGUgPSAndGV4dC9wbGFpbic7XG4gICAgICB9XG4gICAgfSBlbHNlIGlmIChVdGlsLmlzQmxvYihvcHRpb25zKSB8fCBVdGlsLmlzQmxvYihvcHRpb25zLmJvZHkpKSB7XG4gICAgICBjb25zdCBib2R5ID0gb3B0aW9ucyBpbnN0YW5jZW9mIEJsb2IgPyBvcHRpb25zIDogb3B0aW9ucy5ib2R5O1xuICAgICAgY29uc3QgbWltZVR5cGUgPSBVdGlsLmlzQmxvYihvcHRpb25zLmJvZHkpID8gb3B0aW9ucy5taW1lVHlwZSA6IGJvZHkudHlwZTtcbiAgICAgIG5ld09wdGlvbnMgPSB7XG4gICAgICAgIG1pbWVUeXBlLFxuICAgICAgICBib2R5LFxuICAgICAgICBzaXplOiBib2R5LnNpemUsXG4gICAgICAgIGhhc0NvbnRlbnQ6IHRydWUsXG4gICAgICB9O1xuICAgIH1cbiAgICBzdXBlcihuZXdPcHRpb25zKTtcbiAgICBpZiAoIXRoaXMuc2l6ZSAmJiB0aGlzLmJvZHkpIHRoaXMuc2l6ZSA9IHRoaXMuYm9keS5sZW5ndGg7XG5cbiAgICAvLyBEb24ndCBleHBvc2UgZW5jb2Rpbmc7IGJsb2JpZnkgaXQgaWYgaXRzIGVuY29kZWQuXG4gICAgaWYgKG9wdGlvbnMuZW5jb2RpbmcgPT09ICdiYXNlNjQnKSB7XG4gICAgICB0aGlzLmJvZHkgPSBVdGlsLmJhc2U2NFRvQmxvYih0aGlzLmJvZHkpO1xuICAgIH1cblxuICAgIC8vIENvdWxkIGJlIGEgYmxvYiBiZWNhdXNlIGl0IHdhcyByZWFkIG91dCBvZiBpbmRleGVkREIsXG4gICAgLy8gb3IgYmVjYXVzZSBpdCB3YXMgY3JlYXRlZCBsb2NhbGx5IHdpdGggYSBmaWxlXG4gICAgLy8gT3IgYmVjYXVzZSBvZiBiYXNlNjQgZW5jb2RlZCBkYXRhLlxuICAgIGNvbnN0IGlzQmxvYkJvZHkgPSBVdGlsLmlzQmxvYih0aGlzLmJvZHkpO1xuICAgIGNvbnN0IHRleHR1YWwgPSB0aGlzLmlzVGV4dHVhbE1pbWVUeXBlKCk7XG5cbiAgICAvLyBDdXN0b20gaGFuZGxpbmcgZm9yIG5vbi10ZXh0dWFsIGNvbnRlbnRcbiAgICBpZiAoIXRleHR1YWwpIHtcbiAgICAgIC8vIElmIHRoZSBib2R5IGV4aXN0cyBhbmQgaXMgYSBibG9iLCBleHRyYWN0IHRoZSBkYXRhIHVyaSBmb3IgY29udmVuaWVuY2U7IG9ubHkgcmVhbGx5IHJlbGV2YW50IGZvciBpbWFnZSBhbmQgdmlkZW8gSFRNTCB0YWdzLlxuICAgICAgaWYgKCFpc0Jsb2JCb2R5ICYmIHRoaXMuYm9keSkgdGhpcy5ib2R5ID0gbmV3IEJsb2IoW3RoaXMuYm9keV0sIHsgdHlwZTogdGhpcy5taW1lVHlwZSB9KTtcbiAgICAgIGlmICh0aGlzLmJvZHkpIHRoaXMudXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTCh0aGlzLmJvZHkpO1xuICAgIH1cblxuICAgIC8vIElmIG91ciB0ZXh0dWFsIGNvbnRlbnQgaXMgYSBibG9iLCB0dXJuaW5nIGl0IGludG8gdGV4dCBpcyBhc3ljaHJvbm91cywgYW5kIGNhbid0IGJlIGRvbmUgaW4gdGhlIHN5bmNocm9ub3VzIGNvbnN0cnVjdG9yXG4gICAgLy8gVGhpcyB3aWxsIG9ubHkgaGFwcGVuIHdoZW4gdGhlIGNsaWVudCBpcyBhdHRhY2hpbmcgYSBmaWxlLiAgQ29udmVyc2lvbiBmb3IgbG9jYWxseSBjcmVhdGVkIG1lc3NhZ2VzIGlzIGRvbmUgd2hpbGUgY2FsbGluZyBgTWVzc2FnZS5zZW5kKClgXG4gIH1cblxuXG5cbiAgZGVzdHJveSgpIHtcbiAgICBpZiAodGhpcy5fX3VybCkge1xuICAgICAgVVJMLnJldm9rZU9iamVjdFVSTCh0aGlzLl9fdXJsKTtcbiAgICAgIHRoaXMuX191cmwgPSBudWxsO1xuICAgIH1cbiAgICB0aGlzLmJvZHkgPSBudWxsO1xuICAgIHN1cGVyLmRlc3Ryb3koKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBHZXQgdGhlIGxheWVyLkNsaWVudCBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlUGFydC5cbiAgICpcbiAgICogVXNlcyB0aGUgbGF5ZXIuTWVzc2FnZVBhcnQuY2xpZW50SWQgcHJvcGVydHkuXG4gICAqXG4gICAqIEBtZXRob2QgX2dldENsaWVudFxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5DbGllbnR9XG4gICAqL1xuICBfZ2V0Q2xpZW50KCkge1xuICAgIHJldHVybiBDbGllbnRSZWdpc3RyeS5nZXQodGhpcy5jbGllbnRJZCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXllci5NZXNzYWdlIGFzc29jaWF0ZWQgd2l0aCB0aGlzIGxheWVyLk1lc3NhZ2VQYXJ0LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRNZXNzYWdlXG4gICAqIEBwcml2YXRlXG4gICAqIEByZXR1cm4ge2xheWVyLk1lc3NhZ2V9XG4gICAqL1xuICBfZ2V0TWVzc2FnZSgpIHtcbiAgICByZXR1cm4gdGhpcy5fZ2V0Q2xpZW50KCkuZ2V0TWVzc2FnZSh0aGlzLmlkLnJlcGxhY2UoL1xcL3BhcnRzLiokLywgJycpKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBEb3dubG9hZCBSaWNoIENvbnRlbnQgZnJvbSBjbG91ZCBzZXJ2ZXIuXG4gICAqXG4gICAqIEZvciBNZXNzYWdlUGFydHMgd2l0aCByaWNoIGNvbnRlbnQsIHRoaXMgbWV0aG9kIHdpbGwgbG9hZCB0aGUgZGF0YSBmcm9tIGdvb2dsZSdzIGNsb3VkIHN0b3JhZ2UuXG4gICAqIFRoZSBib2R5IHByb3BlcnR5IG9mIHRoaXMgTWVzc2FnZVBhcnQgaXMgc2V0IHRvIHRoZSByZXN1bHQuXG4gICAqXG4gICAqICAgICAgbWVzc2FnZXBhcnQuZmV0Y2hDb250ZW50KClcbiAgICogICAgICAub24oXCJjb250ZW50LWxvYWRlZFwiLCBmdW5jdGlvbigpIHtcbiAgICogICAgICAgICAgcmVuZGVyKG1lc3NhZ2VwYXJ0LmJvZHkpO1xuICAgKiAgICAgIH0pO1xuICAgKlxuICAgKiBOb3RlIHRoYXQgYSBzdWNjZXNzZnVsIGNhbGwgdG8gYGZldGNoQ29udGVudGAgd2lsbCBhbHNvIGNhdXNlIFF1ZXJ5IGNoYW5nZSBldmVudHMgdG8gZmlyZS5cbiAgICogSW4gdGhpcyBleGFtcGxlLCBgcmVuZGVyYCB3aWxsIGJlIGNhbGxlZCBieSB0aGUgcXVlcnkgY2hhbmdlIGV2ZW50IHRoYXQgd2lsbCBvY2N1ciBvbmNlIHRoZSBjb250ZW50IGhhcyBkb3dubG9hZGVkOlxuICAgKlxuICAgKiBgYGBcbiAgICogIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgcmVuZGVyKHF1ZXJ5LmRhdGEpO1xuICAgKiAgfSk7XG4gICAqICBtZXNzYWdlcGFydC5mZXRjaENvbnRlbnQoKTtcbiAgICogYGBgXG4gICAqXG4gICAqXG4gICAqIEBtZXRob2QgZmV0Y2hDb250ZW50XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICogQHBhcmFtIHtNaXhlZH0gY2FsbGJhY2suZGF0YSAtIEVpdGhlciBhIHN0cmluZyAobWltZVR5cGU9dGV4dC9wbGFpbikgb3IgYSBCbG9iIChhbGwgb3RoZXIgbWltZVR5cGVzKVxuICAgKiBAcmV0dXJuIHtsYXllci5Db250ZW50fSB0aGlzXG4gICAqL1xuICBmZXRjaENvbnRlbnQoY2FsbGJhY2spIHtcbiAgICBpZiAodGhpcy5fY29udGVudCAmJiAhdGhpcy5pc0ZpcmluZykge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IHRydWU7XG4gICAgICBjb25zdCB0eXBlID0gdGhpcy5taW1lVHlwZSA9PT0gJ2ltYWdlL2pwZWcrcHJldmlldycgPyAnaW1hZ2UvanBlZycgOiB0aGlzLm1pbWVUeXBlO1xuICAgICAgdGhpcy5fY29udGVudC5sb2FkQ29udGVudCh0eXBlLCAoZXJyLCByZXN1bHQpID0+IHRoaXMuX2ZldGNoQ29udGVudENhbGxiYWNrKGVyciwgcmVzdWx0LCBjYWxsYmFjaykpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG5cbiAgLyoqXG4gICAqIENhbGxiYWNrIHdpdGggcmVzdWx0IG9yIGVycm9yIGZyb20gY2FsbGluZyBmZXRjaENvbnRlbnQuXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBtZXRob2QgX2ZldGNoQ29udGVudENhbGxiYWNrXG4gICAqIEBwYXJhbSB7bGF5ZXIuTGF5ZXJFcnJvcn0gZXJyXG4gICAqIEBwYXJhbSB7T2JqZWN0fSByZXN1bHRcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG4gIF9mZXRjaENvbnRlbnRDYWxsYmFjayhlcnIsIHJlc3VsdCwgY2FsbGJhY2spIHtcbiAgICBpZiAoZXJyKSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ2NvbnRlbnQtbG9hZGVkLWVycm9yJywgZXJyKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5pc0ZpcmluZyA9IGZhbHNlO1xuICAgICAgaWYgKHRoaXMuaXNUZXh0dWFsTWltZVR5cGUoKSkge1xuICAgICAgICBVdGlsLmZldGNoVGV4dEZyb21GaWxlKHJlc3VsdCwgdGV4dCA9PiB0aGlzLl9mZXRjaENvbnRlbnRDb21wbGV0ZSh0ZXh0LCBjYWxsYmFjaykpO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy51cmwgPSBVUkwuY3JlYXRlT2JqZWN0VVJMKHJlc3VsdCk7XG4gICAgICAgIHRoaXMuX2ZldGNoQ29udGVudENvbXBsZXRlKHJlc3VsdCwgY2FsbGJhY2spO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aXRoIFBhcnQgQm9keSBmcm9tIF9mZXRjaENvbnRlbnRDYWxsYmFjay5cbiAgICpcbiAgICogQHByaXZhdGVcbiAgICogQG1ldGhvZCBfZmV0Y2hDb250ZW50Q29tcGxldGVcbiAgICogQHBhcmFtIHtCbG9ifFN0cmluZ30gYm9keVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgKi9cbiAgX2ZldGNoQ29udGVudENvbXBsZXRlKGJvZHksIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dldE1lc3NhZ2UoKTtcblxuICAgIHRoaXMuYm9keSA9IGJvZHk7XG5cbiAgICB0aGlzLnRyaWdnZXIoJ2NvbnRlbnQtbG9hZGVkJyk7XG4gICAgbWVzc2FnZS5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICBvbGRWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIG5ld1ZhbHVlOiBtZXNzYWdlLnBhcnRzLFxuICAgICAgcHJvcGVydHk6ICdwYXJ0cycsXG4gICAgfSk7XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayh0aGlzLmJvZHkpO1xuICB9XG5cblxuICAvKipcbiAgICogQWNjZXNzIHRoZSBVUkwgdG8gdGhlIHJlbW90ZSByZXNvdXJjZS5cbiAgICpcbiAgICogVXNlZnVsIGZvciBzdHJlYW1pbmcgdGhlIGNvbnRlbnQgc28gdGhhdCB5b3UgZG9uJ3QgaGF2ZSB0byBkb3dubG9hZCB0aGUgZW50aXJlIGZpbGUgYmVmb3JlIHJlbmRlcmluZyBpdC5cbiAgICogQWxzbyB1c2VmdWwgZm9yIGNvbnRlbnQgdGhhdCB3aWxsIGJlIG9wZW5uZWQgaW4gYSBuZXcgd2luZG93LCBhbmQgZG9lcyBub3QgbmVlZCB0byBiZSBmZXRjaGVkIG5vdy5cbiAgICpcbiAgICogRm9yIE1lc3NhZ2VQYXJ0cyB3aXRoIFJpY2ggQ29udGVudCwgd2lsbCBsb29rdXAgYSBVUkwgdG8geW91ciBSaWNoIENvbnRlbnQuXG4gICAqIFVzZWZ1bCBmb3Igc3RyZWFtaW5nIGFuZCBjb250ZW50IHNvIHRoYXQgeW91IGRvbid0IGhhdmUgdG8gZG93bmxvYWQgdGhlIGVudGlyZSBmaWxlIGJlZm9yZSByZW5kZXJpbmcgaXQuXG4gICAqXG4gICAqIGBgYFxuICAgKiBtZXNzYWdlcGFydC5mZXRjaFN0cmVhbShmdW5jdGlvbih1cmwpIHtcbiAgICogICAgIHJlbmRlcih1cmwpO1xuICAgKiB9KTtcbiAgICogYGBgXG4gICAqXG4gICAqIE5vdGUgdGhhdCBhIHN1Y2Nlc3NmdWwgY2FsbCB0byBgZmV0Y2hTdHJlYW1gIHdpbGwgYWxzbyBjYXVzZSBRdWVyeSBjaGFuZ2UgZXZlbnRzIHRvIGZpcmUuXG4gICAqIEluIHRoaXMgZXhhbXBsZSwgYHJlbmRlcmAgd2lsbCBiZSBjYWxsZWQgYnkgdGhlIHF1ZXJ5IGNoYW5nZSBldmVudCB0aGF0IHdpbGwgb2NjdXIgb25jZSB0aGUgYHVybGAgaGFzIGJlZW4gcmVmcmVzaGVkOlxuICAgKlxuICAgKiBgYGBcbiAgICogIHF1ZXJ5Lm9uKCdjaGFuZ2UnLCBmdW5jdGlvbihldnQpIHtcbiAgICogICAgICByZW5kZXIocXVlcnkuZGF0YSk7XG4gICAqICB9KTtcbiAgICogIG1lc3NhZ2VwYXJ0LmZldGNoU3RyZWFtKCk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBAbWV0aG9kIGZldGNoU3RyZWFtXG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IFtjYWxsYmFja11cbiAgICogQHBhcmFtIHtNaXhlZH0gY2FsbGJhY2sudXJsXG4gICAqIEByZXR1cm4ge2xheWVyLkNvbnRlbnR9IHRoaXNcbiAgICovXG4gIGZldGNoU3RyZWFtKGNhbGxiYWNrKSB7XG4gICAgaWYgKCF0aGlzLl9jb250ZW50KSB0aHJvdyBuZXcgRXJyb3IoTGF5ZXJFcnJvci5kaWN0aW9uYXJ5LmNvbnRlbnRSZXF1aXJlZCk7XG4gICAgaWYgKHRoaXMuX2NvbnRlbnQuaXNFeHBpcmVkKCkpIHtcbiAgICAgIHRoaXMuX2NvbnRlbnQucmVmcmVzaENvbnRlbnQodGhpcy5fZ2V0Q2xpZW50KCksIHVybCA9PiB0aGlzLl9mZXRjaFN0cmVhbUNvbXBsZXRlKHVybCwgY2FsbGJhY2spKTtcbiAgICB9IGVsc2Uge1xuICAgICAgdGhpcy5fZmV0Y2hTdHJlYW1Db21wbGV0ZSh0aGlzLl9jb250ZW50LmRvd25sb2FkVXJsLCBjYWxsYmFjayk7XG4gICAgfVxuICAgIHJldHVybiB0aGlzO1xuICB9XG5cbiAgLy8gRG9lcyBub3Qgc2V0IHRoaXMudXJsOyBpbnN0ZWFkIHJlbGllcyBvbiBmYWN0IHRoYXQgdGhpcy5fY29udGVudC5kb3dubG9hZFVybCBoYXMgYmVlbiB1cGRhdGVkXG4gIF9mZXRjaFN0cmVhbUNvbXBsZXRlKHVybCwgY2FsbGJhY2spIHtcbiAgICBjb25zdCBtZXNzYWdlID0gdGhpcy5fZ2V0TWVzc2FnZSgpO1xuXG4gICAgdGhpcy50cmlnZ2VyKCd1cmwtbG9hZGVkJyk7XG4gICAgbWVzc2FnZS5fdHJpZ2dlckFzeW5jKCdtZXNzYWdlczpjaGFuZ2UnLCB7XG4gICAgICBvbGRWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIG5ld1ZhbHVlOiBtZXNzYWdlLnBhcnRzLFxuICAgICAgcHJvcGVydHk6ICdwYXJ0cycsXG4gICAgfSk7XG4gICAgaWYgKGNhbGxiYWNrKSBjYWxsYmFjayh1cmwpO1xuICB9XG5cbiAgLyoqXG4gICAqIFByZXBzIGEgTWVzc2FnZVBhcnQgZm9yIHNlbmRpbmcuICBOb3JtYWxseSB0aGF0IGlzIHRyaXZpYWwuXG4gICAqIEJ1dCBpZiB0aGVyZSBpcyByaWNoIGNvbnRlbnQsIHRoZW4gdGhlIGNvbnRlbnQgbXVzdCBiZSB1cGxvYWRlZFxuICAgKiBhbmQgdGhlbiB3ZSBjYW4gdHJpZ2dlciBhIFwicGFydHM6c2VuZFwiIGV2ZW50IGluZGljYXRpbmcgdGhhdFxuICAgKiB0aGUgcGFydCBpcyByZWFkeSB0byBzZW5kLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZW5kXG4gICAqIEBwcm90ZWN0ZWRcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICogQGZpcmVzIHBhcnRzOnNlbmRcbiAgICovXG4gIF9zZW5kUGFydChjbGllbnQpIHtcbiAgICAvLyBUaGVyZSBpcyBhbHJlYWR5IGEgQ29udGVudCBvYmplY3QsIHByZXN1bWFibHkgdGhlIGRldmVsb3BlclxuICAgIC8vIGFscmVhZHkgdG9vayBjYXJlIG9mIHRoaXMgc3RlcCBmb3IgdXMuXG4gICAgaWYgKHRoaXMuX2NvbnRlbnQpIHtcbiAgICAgIHRoaXMuX3NlbmRXaXRoQ29udGVudCgpO1xuICAgIH1cblxuICAgIC8vIElmIHRoZSBzaXplIGlzIGxhcmdlLCBDcmVhdGUgYW5kIHVwbG9hZCB0aGUgQ29udGVudFxuICAgIGVsc2UgaWYgKHRoaXMuc2l6ZSA+IDIwNDgpIHtcbiAgICAgIHRoaXMuX2dlbmVyYXRlQ29udGVudEFuZFNlbmQoY2xpZW50KTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgYm9keSBpcyBhIGJsb2IsIGJ1dCBpcyBub3QgWUVUIFJpY2ggQ29udGVudCwgZG8gc29tZSBjdXN0b20gYW5hbHlzaXMvcHJvY2Vzc2luZzpcbiAgICBlbHNlIGlmIChVdGlsLmlzQmxvYih0aGlzLmJvZHkpKSB7XG4gICAgICB0aGlzLl9zZW5kQmxvYihjbGllbnQpO1xuICAgIH1cblxuICAgIC8vIEVsc2UgdGhlIG1lc3NhZ2UgcGFydCBjYW4gYmUgc2VudCBhcyBpcy5cbiAgICBlbHNlIHtcbiAgICAgIHRoaXMuX3NlbmRCb2R5KCk7XG4gICAgfVxuICB9XG5cbiAgX3NlbmQoY2xpZW50KSB7XG4gICAgaWYgKHR5cGVvZiB0aGlzLmxhenlSZXNvbHZlID09PSAnZnVuY3Rpb24nKSB7XG4gICAgICB0aGlzLmxhenlSZXNvbHZlKHRoaXMsIChyZXN1bHQpID0+IHtcbiAgICAgICAgT2JqZWN0LmFzc2lnbih0aGlzLCByZXN1bHQpO1xuICAgICAgICB0aGlzLl9zZW5kUGFydChjbGllbnQpO1xuICAgICAgfSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX3NlbmRQYXJ0KGNsaWVudCk7XG4gICAgfVxuICB9XG5cbiAgX3NlbmRCb2R5KCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5ib2R5ICE9PSAnc3RyaW5nJykge1xuICAgICAgY29uc3QgZXJyID0gJ01lc3NhZ2VQYXJ0LmJvZHkgbXVzdCBiZSBhIHN0cmluZyBpbiBvcmRlciB0byBzZW5kIGl0JztcbiAgICAgIGxvZ2dlci5lcnJvcihlcnIsIHsgbWltZVR5cGU6IHRoaXMubWltZVR5cGUsIGJvZHk6IHRoaXMuYm9keSB9KTtcbiAgICAgIHRocm93IG5ldyBFcnJvcihlcnIpO1xuICAgIH1cblxuICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgIGJvZHk6IHRoaXMuYm9keSxcbiAgICB9O1xuICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIG9iaik7XG4gIH1cblxuICBfc2VuZFdpdGhDb250ZW50KCkge1xuICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIHtcbiAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgIGNvbnRlbnQ6IHtcbiAgICAgICAgc2l6ZTogdGhpcy5zaXplLFxuICAgICAgICBpZDogdGhpcy5fY29udGVudC5pZCxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogVGhpcyBtZXRob2QgaXMgb25seSBjYWxsZWQgaWYgQmxvYi5zaXplIDwgMjA0OC5cbiAgICpcbiAgICogSG93ZXZlciwgY29udmVyc2lvbiB0byBiYXNlNjQgY2FuIGltcGFjdCB0aGUgc2l6ZSwgc28gd2UgbXVzdCByZXRlc3QgdGhlIHNpemVcbiAgICogYWZ0ZXIgY29udmVyc2lvbiwgYW5kIHRoZW4gZGVjaWRlIHRvIHNlbmQgdGhlIG9yaWdpbmFsIGJsb2Igb3IgdGhlIGJhc2U2NCBlbmNvZGVkIGRhdGEuXG4gICAqXG4gICAqIEBtZXRob2QgX3NlbmRCbG9iXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICovXG4gIF9zZW5kQmxvYihjbGllbnQpIHtcbiAgICAvKiBpc3RhbmJ1bCBpZ25vcmUgZWxzZSAqL1xuICAgIFV0aWwuYmxvYlRvQmFzZTY0KHRoaXMuYm9keSwgKGJhc2U2NGRhdGEpID0+IHtcbiAgICAgIGlmIChiYXNlNjRkYXRhLmxlbmd0aCA8IDIwNDgpIHtcbiAgICAgICAgY29uc3QgYm9keSA9IGJhc2U2NGRhdGEuc3Vic3RyaW5nKGJhc2U2NGRhdGEuaW5kZXhPZignLCcpICsgMSk7XG4gICAgICAgIGNvbnN0IG9iaiA9IHtcbiAgICAgICAgICBib2R5LFxuICAgICAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgICAgfTtcbiAgICAgICAgb2JqLmVuY29kaW5nID0gJ2Jhc2U2NCc7XG4gICAgICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIG9iaik7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICB0aGlzLl9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kKGNsaWVudCk7XG4gICAgICB9XG4gICAgfSk7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlIGFuIHJpY2ggQ29udGVudCBvYmplY3Qgb24gdGhlIHNlcnZlclxuICAgKiBhbmQgdGhlbiBjYWxsIF9wcm9jZXNzQ29udGVudFJlc3BvbnNlXG4gICAqXG4gICAqIEBtZXRob2QgX2dlbmVyYXRlQ29udGVudEFuZFNlbmRcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICovXG4gIF9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kKGNsaWVudCkge1xuICAgIHRoaXMuaGFzQ29udGVudCA9IHRydWU7XG4gICAgbGV0IGJvZHk7XG4gICAgaWYgKCFVdGlsLmlzQmxvYih0aGlzLmJvZHkpKSB7XG4gICAgICBib2R5ID0gVXRpbC5iYXNlNjRUb0Jsb2IoVXRpbC51dG9hKHRoaXMuYm9keSksIHRoaXMubWltZVR5cGUpO1xuICAgIH0gZWxzZSB7XG4gICAgICBib2R5ID0gdGhpcy5ib2R5O1xuICAgIH1cbiAgICBjbGllbnQueGhyKHtcbiAgICAgIHVybDogJy9jb250ZW50JyxcbiAgICAgIG1ldGhvZDogJ1BPU1QnLFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtVHlwZSc6IHRoaXMubWltZVR5cGUsXG4gICAgICAgICdVcGxvYWQtQ29udGVudC1MZW5ndGgnOiBib2R5LnNpemUsXG4gICAgICAgICdVcGxvYWQtT3JpZ2luJzogdHlwZW9mIGxvY2F0aW9uICE9PSAndW5kZWZpbmVkJyA/IGxvY2F0aW9uLm9yaWdpbiA6ICcnLFxuICAgICAgfSxcbiAgICAgIHN5bmM6IHt9LFxuICAgIH0sIHJlc3VsdCA9PiB7XG4gICAgICB0aGlzLl9wcm9jZXNzQ29udGVudFJlc3BvbnNlKHJlc3VsdC5kYXRhLCBib2R5LCBjbGllbnQpO1xuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBsYXllci5Db250ZW50IG9iamVjdCBmcm9tIHRoZSBzZXJ2ZXInc1xuICAgKiBDb250ZW50IG9iamVjdCwgYW5kIHRoZW4gdXBsb2FkcyB0aGUgZGF0YSB0byBnb29nbGUgY2xvdWQgc3RvcmFnZS5cbiAgICpcbiAgICogQG1ldGhvZCBfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHJlc3BvbnNlXG4gICAqIEBwYXJhbSAge0Jsb2J9IGJvZHlcbiAgICogQHBhcmFtICB7bGF5ZXIuQ2xpZW50fSBjbGllbnRcbiAgICovXG4gIF9wcm9jZXNzQ29udGVudFJlc3BvbnNlKHJlc3BvbnNlLCBib2R5LCBjbGllbnQpIHtcbiAgICB0aGlzLl9jb250ZW50ID0gbmV3IENvbnRlbnQocmVzcG9uc2UuaWQpO1xuICAgIHRoaXMuaGFzQ29udGVudCA9IHRydWU7XG5cbiAgICB4aHIoe1xuICAgICAgdXJsOiByZXNwb25zZS51cGxvYWRfdXJsLFxuICAgICAgbWV0aG9kOiAnUFVUJyxcbiAgICAgIGRhdGE6IGJvZHksXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgICdVcGxvYWQtQ29udGVudC1MZW5ndGgnOiB0aGlzLnNpemUsXG4gICAgICAgICdVcGxvYWQtQ29udGVudC1UeXBlJzogdGhpcy5taW1lVHlwZSxcbiAgICAgIH0sXG4gICAgfSwgcmVzdWx0ID0+IHRoaXMuX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2UocmVzdWx0LCByZXNwb25zZSwgY2xpZW50KSk7XG4gIH1cblxuICBfcHJvY2Vzc0NvbnRlbnRVcGxvYWRSZXNwb25zZSh1cGxvYWRSZXN1bHQsIGNvbnRlbnRSZXNwb25zZSwgY2xpZW50KSB7XG4gICAgaWYgKCF1cGxvYWRSZXN1bHQuc3VjY2Vzcykge1xuICAgICAgaWYgKCFjbGllbnQub25saW5lTWFuYWdlci5pc09ubGluZSkge1xuICAgICAgICBjbGllbnQub25saW5lTWFuYWdlci5vbmNlKCdjb25uZWN0ZWQnLCB0aGlzLl9wcm9jZXNzQ29udGVudFJlc3BvbnNlLmJpbmQodGhpcywgY29udGVudFJlc3BvbnNlLCBjbGllbnQpLCB0aGlzKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIGxvZ2dlci5lcnJvcignV2UgZG9uXFwndCB5ZXQgaGFuZGxlIHRoaXMhJyk7XG4gICAgICB9XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMudHJpZ2dlcigncGFydHM6c2VuZCcsIHtcbiAgICAgICAgbWltZV90eXBlOiB0aGlzLm1pbWVUeXBlLFxuICAgICAgICBjb250ZW50OiB7XG4gICAgICAgICAgc2l6ZTogdGhpcy5zaXplLFxuICAgICAgICAgIGlkOiB0aGlzLl9jb250ZW50LmlkLFxuICAgICAgICB9LFxuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIFJldHVybnMgdGhlIHRleHQgZm9yIGFueSB0ZXh0L3BsYWluIHBhcnQuXG4gICAqXG4gICAqIFJldHVybnMgJycgaWYgaXRzIG5vdCBhIHRleHQvcGxhaW4gcGFydC5cbiAgICpcbiAgICogQG1ldGhvZCBnZXRUZXh0XG4gICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICovXG4gIGdldFRleHQoKSB7XG4gICAgaWYgKHRoaXMuaXNUZXh0dWFsTWltZVR5cGUoKSkge1xuICAgICAgcmV0dXJuIHRoaXMuYm9keTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuICcnO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBVcGRhdGVzIHRoZSBNZXNzYWdlUGFydCB3aXRoIG5ldyBkYXRhIGZyb20gdGhlIHNlcnZlci5cbiAgICpcbiAgICogQ3VycmVudGx5LCBNZXNzYWdlUGFydCBwcm9wZXJ0aWVzIGRvIG5vdCB1cGRhdGUuLi4gaG93ZXZlcixcbiAgICogdGhlIGxheWVyLkNvbnRlbnQgb2JqZWN0IHRoYXQgUmljaCBDb250ZW50IE1lc3NhZ2VQYXJ0cyBjb250YWluXG4gICAqIGRvIGdldCB1cGRhdGVkIHdpdGggcmVmcmVzaGVkIGV4cGlyaW5nIHVybHMuXG4gICAqXG4gICAqIEBtZXRob2QgX3BvcHVsYXRlRnJvbVNlcnZlclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IHBhcnQgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBwYXJ0XG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBfcG9wdWxhdGVGcm9tU2VydmVyKHBhcnQpIHtcbiAgICBpZiAocGFydC5jb250ZW50ICYmIHRoaXMuX2NvbnRlbnQpIHtcbiAgICAgIHRoaXMuX2NvbnRlbnQuZG93bmxvYWRVcmwgPSBwYXJ0LmNvbnRlbnQuZG93bmxvYWRfdXJsO1xuICAgICAgdGhpcy5fY29udGVudC5leHBpcmF0aW9uID0gbmV3IERhdGUocGFydC5jb250ZW50LmV4cGlyYXRpb24pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJcyB0aGUgbWltZVR5cGUgZm9yIHRoaXMgTWVzc2FnZVBhcnQgZGVmaW5lZCBhcyB0ZXh0dWFsIGNvbnRlbnQ/XG4gICAqXG4gICAqIElmIHRoZSBhbnN3ZXIgaXMgdHJ1ZSwgZXhwZWN0IGEgYGJvZHlgIG9mIHN0cmluZywgZWxzZSBleHBlY3QgYGJvZHlgIG9mIEJsb2IuXG4gICAqXG4gICAqIFRvIGNoYW5nZSB3aGV0aGVyIGEgZ2l2ZW4gTUlNRSBUeXBlIGlzIHRyZWF0ZWQgYXMgdGV4dHVhbCwgc2VlIGxheWVyLk1lc3NhZ2VQYXJ0LlRleHR1YWxNaW1lVHlwZXMuXG4gICAqXG4gICAqIEBtZXRob2QgaXNUZXh0dWFsTWltZVR5cGVcbiAgICogQHJldHVybnMge0Jvb2xlYW59XG4gICAqL1xuICBpc1RleHR1YWxNaW1lVHlwZSgpIHtcbiAgICBsZXQgaSA9IDA7XG4gICAgZm9yIChpID0gMDsgaSA8IE1lc3NhZ2VQYXJ0LlRleHR1YWxNaW1lVHlwZXMubGVuZ3RoOyBpKyspIHtcbiAgICAgIGNvbnN0IHRlc3QgPSBNZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzW2ldO1xuICAgICAgaWYgKHR5cGVvZiB0ZXN0ID09PSAnc3RyaW5nJykge1xuICAgICAgICBpZiAodGVzdCA9PT0gdGhpcy5taW1lVHlwZSkgcmV0dXJuIHRydWU7XG4gICAgICB9IGVsc2UgaWYgKHRlc3QgaW5zdGFuY2VvZiBSZWdFeHApIHtcbiAgICAgICAgaWYgKHRoaXMubWltZVR5cGUubWF0Y2godGVzdCkpIHJldHVybiB0cnVlO1xuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gZmFsc2U7XG4gIH1cblxuICAvKipcbiAgICogQ3JlYXRlcyBhIE1lc3NhZ2VQYXJ0IGZyb20gYSBzZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgdGhlIHBhcnRcbiAgICpcbiAgICogQG1ldGhvZCBfY3JlYXRlRnJvbVNlcnZlclxuICAgKiBAcHJpdmF0ZVxuICAgKiBAc3RhdGljXG4gICAqIEBwYXJhbSAge09iamVjdH0gcGFydCAtIFNlcnZlciByZXByZXNlbnRhdGlvbiBvZiBhIHBhcnRcbiAgICovXG4gIHN0YXRpYyBfY3JlYXRlRnJvbVNlcnZlcihwYXJ0KSB7XG4gICAgY29uc3QgY29udGVudCA9IChwYXJ0LmNvbnRlbnQpID8gQ29udGVudC5fY3JlYXRlRnJvbVNlcnZlcihwYXJ0LmNvbnRlbnQpIDogbnVsbDtcblxuICAgIC8vIFR1cm4gYmFzZTY0IGRhdGEgaW50byBhIEJsb2JcbiAgICBpZiAocGFydC5lbmNvZGluZyA9PT0gJ2Jhc2U2NCcpIHBhcnQuYm9keSA9IFV0aWwuYmFzZTY0VG9CbG9iKHBhcnQuYm9keSwgcGFydC5taW1lVHlwZSk7XG5cbiAgICAvLyBDcmVhdGUgdGhlIE1lc3NhZ2VQYXJ0XG4gICAgcmV0dXJuIG5ldyBNZXNzYWdlUGFydCh7XG4gICAgICBpZDogcGFydC5pZCxcbiAgICAgIG1pbWVUeXBlOiBwYXJ0Lm1pbWVfdHlwZSxcbiAgICAgIGJvZHk6IHBhcnQuYm9keSB8fCAnJyxcbiAgICAgIF9jb250ZW50OiBjb250ZW50LFxuICAgICAgaGFzQ29udGVudDogQm9vbGVhbihjb250ZW50KSxcbiAgICAgIHNpemU6IHBhcnQuc2l6ZSB8fCAwLFxuICAgIH0pO1xuICB9XG59XG5cbi8qKlxuICogbGF5ZXIuQ2xpZW50IHRoYXQgdGhlIGNvbnZlcnNhdGlvbiBiZWxvbmdzIHRvLlxuICpcbiAqIEFjdHVhbCB2YWx1ZSBvZiB0aGlzIHN0cmluZyBtYXRjaGVzIHRoZSBhcHBJZC5cbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5jbGllbnRJZCA9ICcnO1xuXG4vKipcbiAqIFNlcnZlciBnZW5lcmF0ZWQgaWRlbnRpZmllciBmb3IgdGhlIHBhcnRcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5pZCA9ICcnO1xuXG4vKipcbiAqIEFsbG93IGxhenkgcmVzb2x2ZSBtZXNzYWdlIHBhcnQgZmllbGRzIChib2R5LCBzaXplLCBjb250ZW50LCBldGMpXG4gKlxuICogQHR5cGUge2Z1bmN0aW9ufVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUubGF6eVJlc29sdmUgPSBudWxsO1xuXG4vKipcbiAqIEJvZHkgb2YgeW91ciBtZXNzYWdlIHBhcnQuXG4gKlxuICogVGhpcyBpcyB0aGUgY29yZSBkYXRhIG9mIHlvdXIgcGFydC5cbiAqXG4gKiBJZiB0aGlzIGlzIGBudWxsYCB0aGVuIG1vc3QgbGlrZWx5IGxheWVyLk1lc3NhZ2UuaGFzQ29udGVudCBpcyB0cnVlLCBhbmQgeW91XG4gKiBjYW4gZWl0aGVyIHVzZSB0aGUgbGF5ZXIuTWVzc2FnZVBhcnQudXJsIHByb3BlcnR5IG9yIHRoZSBsYXllci5NZXNzYWdlUGFydC5mZXRjaENvbnRlbnQgbWV0aG9kLlxuICpcbiAqIEB0eXBlIHtzdHJpbmd9XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5ib2R5ID0gbnVsbDtcblxuLyoqXG4gKiBSaWNoIGNvbnRlbnQgb2JqZWN0LlxuICpcbiAqIFRoaXMgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGNyZWF0ZWQgZm9yIHlvdSBpZiB5b3VyIGxheWVyLk1lc3NhZ2VQYXJ0LmJvZHlcbiAqIGlzIGxhcmdlLlxuICogQHR5cGUge2xheWVyLkNvbnRlbnR9XG4gKiBAcHJpdmF0ZVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuX2NvbnRlbnQgPSBudWxsO1xuXG4vKipcbiAqIFRoZSBQYXJ0IGhhcyByaWNoIGNvbnRlbnRcbiAqIEB0eXBlIHtCb29sZWFufVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuaGFzQ29udGVudCA9IGZhbHNlO1xuXG4vKipcbiAqIFVSTCB0byByaWNoIGNvbnRlbnQgb2JqZWN0LlxuICpcbiAqIFBhcnRzIHdpdGggcmljaCBjb250ZW50IHdpbGwgYmUgaW5pdGlhbGl6ZWQgd2l0aCB0aGlzIHByb3BlcnR5IHNldC4gIEJ1dCBpdHMgdmFsdWUgd2lsbCBleHBpcmUuXG4gKlxuICogV2lsbCBjb250YWluIGFuIGV4cGlyaW5nIHVybCBhdCBpbml0aWFsaXphdGlvbiB0aW1lIGFuZCBiZSByZWZyZXNoZWQgd2l0aCBjYWxscyB0byBgbGF5ZXIuTWVzc2FnZVBhcnQuZmV0Y2hTdHJlYW0oKWAuXG4gKiBXaWxsIGNvbnRhaW4gYSBub24tZXhwaXJpbmcgdXJsIHRvIGEgbG9jYWwgcmVzb3VyY2UgaWYgYGxheWVyLk1lc3NhZ2VQYXJ0LmZldGNoQ29udGVudCgpYCBpcyBjYWxsZWQuXG4gKlxuICogQHR5cGUge2xheWVyLkNvbnRlbnR9XG4gKi9cbk9iamVjdC5kZWZpbmVQcm9wZXJ0eShNZXNzYWdlUGFydC5wcm90b3R5cGUsICd1cmwnLCB7XG4gIGVudW1lcmFibGU6IHRydWUsXG4gIGdldDogZnVuY3Rpb24gZ2V0KCkge1xuICAgIC8vIEl0cyBwb3NzaWJsZSB0byBoYXZlIGEgdXJsIGFuZCBubyBjb250ZW50IGlmIGl0IGhhcyBiZWVuIGluc3RhbnRpYXRlZCBidXQgbm90IHlldCBzZW50LlxuICAgIC8vIElmIHRoZXJlIGlzIGEgX191cmwgdGhlbiBpdHMgYSBsb2NhbCB1cmwgZ2VuZXJhdGVkIGZyb20gdGhlIGJvZHkgcHJvcGVydHkgYW5kIGRvZXMgbm90IGV4cGlyZS5cbiAgICBpZiAodGhpcy5fX3VybCkgcmV0dXJuIHRoaXMuX191cmw7XG4gICAgaWYgKHRoaXMuX2NvbnRlbnQpIHJldHVybiB0aGlzLl9jb250ZW50LmlzRXhwaXJlZCgpID8gJycgOiB0aGlzLl9jb250ZW50LmRvd25sb2FkVXJsO1xuICAgIHJldHVybiAnJztcbiAgfSxcbiAgc2V0OiBmdW5jdGlvbiBzZXQoaW5WYWx1ZSkge1xuICAgIHRoaXMuX191cmwgPSBpblZhbHVlO1xuICB9LFxufSk7XG5cbi8qKlxuICogTWltZSBUeXBlIGZvciB0aGUgZGF0YSByZXByZXNlbnRlZCBieSB0aGUgTWVzc2FnZVBhcnQuXG4gKlxuICogVHlwaWNhbGx5IHRoaXMgaXMgdGhlIHR5cGUgZm9yIHRoZSBkYXRhIGluIGxheWVyLk1lc3NhZ2VQYXJ0LmJvZHk7XG4gKiBpZiB0aGVyZSBpcyBSaWNoIENvbnRlbnQsIHRoZW4gaXRzIHRoZSB0eXBlIG9mIENvbnRlbnQgdGhhdCBuZWVkcyB0byBiZVxuICogZG93bmxvYWRlZC5cbiAqXG4gKiBAdHlwZSB7U3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUubWltZVR5cGUgPSAndGV4dC9wbGFpbic7XG5cbi8qKlxuICogU2l6ZSBvZiB0aGUgbGF5ZXIuTWVzc2FnZVBhcnQuYm9keS5cbiAqXG4gKiBXaWxsIGJlIHNldCBmb3IgeW91IGlmIG5vdCBwcm92aWRlZC5cbiAqIE9ubHkgbmVlZGVkIGZvciB1c2Ugd2l0aCByaWNoIGNvbnRlbnQuXG4gKlxuICogQHR5cGUge251bWJlcn1cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLnNpemUgPSAwO1xuXG4vKipcbiAqIEFycmF5IG9mIG1pbWUgdHlwZXMgdGhhdCBzaG91bGQgYmUgdHJlYXRlZCBhcyB0ZXh0LlxuICpcbiAqIFRyZWF0aW5nIGEgTWVzc2FnZVBhcnQgYXMgdGV4dCBtZWFucyB0aGF0IGV2ZW4gaWYgdGhlIGBib2R5YCBnZXRzIGEgRmlsZSBvciBCbG9iLFxuICogaXQgd2lsbCBiZSB0cmFuc2Zvcm1lZCB0byBhIHN0cmluZyBiZWZvcmUgYmVpbmcgZGVsaXZlcmVkIHRvIHlvdXIgYXBwLlxuICpcbiAqIFRoaXMgdmFsdWUgY2FuIGJlIGN1c3RvbWl6ZWQgdXNpbmcgc3RyaW5ncyBhbmQgcmVndWxhciBleHByZXNzaW9uczpcbiAqXG4gKiBgYGBcbiAqIGxheWVyLk1lc3NhZ2VQYXJ0LlRleHR1YWxNaW1lVHlwZXMgPSBbJ3RleHQvcGxhaW4nLCAndGV4dC9tb3VudGFpbicsIC9eYXBwbGljYXRpb25cXC9qc29uKFxcKy4rKSQvXVxuICogYGBgXG4gKlxuICogQHN0YXRpY1xuICogQHR5cGUge01peGVkW119XG4gKi9cbk1lc3NhZ2VQYXJ0LlRleHR1YWxNaW1lVHlwZXMgPSBbL150ZXh0XFwvLiskLywgL15hcHBsaWNhdGlvblxcL2pzb24oXFwrLispPyQvXTtcblxuTWVzc2FnZVBhcnQuX3N1cHBvcnRlZEV2ZW50cyA9IFtcbiAgJ3BhcnRzOnNlbmQnLFxuICAnY29udGVudC1sb2FkZWQnLFxuICAndXJsLWxvYWRlZCcsXG4gICdjb250ZW50LWxvYWRlZC1lcnJvcicsXG5dLmNvbmNhdChSb290Ll9zdXBwb3J0ZWRFdmVudHMpO1xuUm9vdC5pbml0Q2xhc3MuYXBwbHkoTWVzc2FnZVBhcnQsIFtNZXNzYWdlUGFydCwgJ01lc3NhZ2VQYXJ0J10pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE1lc3NhZ2VQYXJ0O1xuIl19
