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
    value: function _send() {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9tZXNzYWdlLXBhcnQuanMiXSwibmFtZXMiOlsiUm9vdCIsInJlcXVpcmUiLCJDb250ZW50IiwieGhyIiwiQ2xpZW50UmVnaXN0cnkiLCJMYXllckVycm9yIiwiVXRpbCIsImxvZ2dlciIsIk1lc3NhZ2VQYXJ0Iiwib3B0aW9ucyIsIm5ld09wdGlvbnMiLCJib2R5IiwibWltZVR5cGUiLCJpc0Jsb2IiLCJCbG9iIiwidHlwZSIsInNpemUiLCJoYXNDb250ZW50IiwibGVuZ3RoIiwiZW5jb2RpbmciLCJiYXNlNjRUb0Jsb2IiLCJpc0Jsb2JCb2R5IiwidGV4dHVhbCIsImlzVGV4dHVhbE1pbWVUeXBlIiwidXJsIiwiVVJMIiwiY3JlYXRlT2JqZWN0VVJMIiwiX191cmwiLCJyZXZva2VPYmplY3RVUkwiLCJnZXQiLCJjbGllbnRJZCIsIl9nZXRDbGllbnQiLCJnZXRNZXNzYWdlIiwiaWQiLCJyZXBsYWNlIiwiY2FsbGJhY2siLCJfY29udGVudCIsImlzRmlyaW5nIiwibG9hZENvbnRlbnQiLCJlcnIiLCJyZXN1bHQiLCJfZmV0Y2hDb250ZW50Q2FsbGJhY2siLCJ0cmlnZ2VyIiwiZmV0Y2hUZXh0RnJvbUZpbGUiLCJfZmV0Y2hDb250ZW50Q29tcGxldGUiLCJ0ZXh0IiwibWVzc2FnZSIsIl9nZXRNZXNzYWdlIiwiX3RyaWdnZXJBc3luYyIsIm9sZFZhbHVlIiwicGFydHMiLCJuZXdWYWx1ZSIsInByb3BlcnR5IiwiRXJyb3IiLCJkaWN0aW9uYXJ5IiwiY29udGVudFJlcXVpcmVkIiwiaXNFeHBpcmVkIiwicmVmcmVzaENvbnRlbnQiLCJfZmV0Y2hTdHJlYW1Db21wbGV0ZSIsImRvd25sb2FkVXJsIiwiY2xpZW50IiwiX3NlbmRXaXRoQ29udGVudCIsIl9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kIiwiX3NlbmRCbG9iIiwiX3NlbmRCb2R5IiwibGF6eVJlc29sdmUiLCJPYmplY3QiLCJhc3NpZ24iLCJfc2VuZFBhcnQiLCJlcnJvciIsIm9iaiIsIm1pbWVfdHlwZSIsImNvbnRlbnQiLCJibG9iVG9CYXNlNjQiLCJiYXNlNjRkYXRhIiwic3Vic3RyaW5nIiwiaW5kZXhPZiIsInV0b2EiLCJtZXRob2QiLCJoZWFkZXJzIiwibG9jYXRpb24iLCJvcmlnaW4iLCJzeW5jIiwiX3Byb2Nlc3NDb250ZW50UmVzcG9uc2UiLCJkYXRhIiwicmVzcG9uc2UiLCJ1cGxvYWRfdXJsIiwiX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2UiLCJ1cGxvYWRSZXN1bHQiLCJjb250ZW50UmVzcG9uc2UiLCJzdWNjZXNzIiwib25saW5lTWFuYWdlciIsImlzT25saW5lIiwib25jZSIsImJpbmQiLCJwYXJ0IiwiZG93bmxvYWRfdXJsIiwiZXhwaXJhdGlvbiIsIkRhdGUiLCJpIiwiVGV4dHVhbE1pbWVUeXBlcyIsInRlc3QiLCJSZWdFeHAiLCJtYXRjaCIsIl9jcmVhdGVGcm9tU2VydmVyIiwiQm9vbGVhbiIsInByb3RvdHlwZSIsImRlZmluZVByb3BlcnR5IiwiZW51bWVyYWJsZSIsInNldCIsImluVmFsdWUiLCJfc3VwcG9ydGVkRXZlbnRzIiwiY29uY2F0IiwiaW5pdENsYXNzIiwiYXBwbHkiLCJtb2R1bGUiLCJleHBvcnRzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpRUEsSUFBTUEsT0FBT0MsUUFBUSxRQUFSLENBQWI7QUFDQSxJQUFNQyxVQUFVRCxRQUFRLFdBQVIsQ0FBaEI7QUFDQSxJQUFNRSxNQUFNRixRQUFRLE9BQVIsQ0FBWjtBQUNBLElBQU1HLGlCQUFpQkgsUUFBUSxtQkFBUixDQUF2QjtBQUNBLElBQU1JLGFBQWFKLFFBQVEsZUFBUixDQUFuQjtBQUNBLElBQU1LLE9BQU9MLFFBQVEsZ0JBQVIsQ0FBYjtBQUNBLElBQU1NLFNBQVNOLFFBQVEsVUFBUixDQUFmOztJQUVNTyxXOzs7QUFFSjs7Ozs7Ozs7Ozs7QUFXQSx1QkFB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R0FBYW1GLE9BQWI7QUFDRDtBQVhpRCxDQUFwRDs7QUFjQTs7Ozs7Ozs7O0FBU0F0RyxZQUFZa0csU0FBWixDQUFzQjlGLFFBQXRCLEdBQWlDLFlBQWpDOztBQUVBOzs7Ozs7OztBQVFBSixZQUFZa0csU0FBWixDQUFzQjFGLElBQXRCLEdBQTZCLENBQTdCOztBQUVBOzs7Ozs7Ozs7Ozs7Ozs7QUFlQVIsWUFBWTRGLGdCQUFaLEdBQStCLENBQUMsWUFBRCxFQUFlLDRCQUFmLENBQS9COztBQUVBNUYsWUFBWXVHLGdCQUFaLEdBQStCLENBQzdCLFlBRDZCLEVBRTdCLGdCQUY2QixFQUc3QixZQUg2QixFQUk3QixzQkFKNkIsRUFLN0JDLE1BTDZCLENBS3RCaEgsS0FBSytHLGdCQUxpQixDQUEvQjtBQU1BL0csS0FBS2lILFNBQUwsQ0FBZUMsS0FBZixDQUFxQjFHLFdBQXJCLEVBQWtDLENBQUNBLFdBQUQsRUFBYyxhQUFkLENBQWxDOztBQUVBMkcsT0FBT0MsT0FBUCxHQUFpQjVHLFdBQWpCIiwiZmlsZSI6Im1lc3NhZ2UtcGFydC5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxuICogVGhlIE1lc3NhZ2VQYXJ0IGNsYXNzIHJlcHJlc2VudHMgYW4gZWxlbWVudCBvZiBhIG1lc3NhZ2UuXG4gKlxuICogICAgICAvLyBDcmVhdGUgYSBNZXNzYWdlIFBhcnQgd2l0aCBhbnkgbWltZVR5cGVcbiAqICAgICAgdmFyIHBhcnQgPSBuZXcgbGF5ZXIuTWVzc2FnZVBhcnQoe1xuICogICAgICAgICAgYm9keTogXCJoZWxsb1wiLFxuICogICAgICAgICAgbWltZVR5cGU6IFwidGV4dC9wbGFpblwiXG4gKiAgICAgIH0pO1xuICpcbiAqICAgICAgLy8gQ3JlYXRlIGEgdGV4dC9wbGFpbiBvbmx5IE1lc3NhZ2UgUGFydFxuICogICAgICB2YXIgcGFydCA9IG5ldyBsYXllci5NZXNzYWdlUGFydChcIkhlbGxvIEkgYW0gdGV4dC9wbGFpblwiKTtcbiAqXG4gKiBZb3UgY2FuIGFsc28gY3JlYXRlIGEgTWVzc2FnZSBQYXJ0IGZyb20gYSBGaWxlIElucHV0IGRvbSBub2RlOlxuICpcbiAqICAgICAgdmFyIGZpbGVJbnB1dE5vZGUgPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChcIm15RmlsZUlucHV0XCIpO1xuICogICAgICB2YXIgcGFydCA9IG5ldyBsYXllci5NZXNzYWdlUGFydChmaWxlSW5wdXROb2RlLmZpbGVzWzBdKTtcbiAqXG4gKiBZb3UgY2FuIGFsc28gY3JlYXRlIE1lc3NhZ2UgUGFydHMgZnJvbSBhIGZpbGUgZHJhZyBhbmQgZHJvcCBvcGVyYXRpb246XG4gKlxuICogICAgICBvbkZpbGVEcm9wOiBmdW5jdGlvbihldnQpIHtcbiAqICAgICAgICAgICB2YXIgZmlsZXMgPSBldnQuZGF0YVRyYW5zZmVyLmZpbGVzO1xuICogICAgICAgICAgIHZhciBtID0gY29udmVyc2F0aW9uLmNyZWF0ZU1lc3NhZ2Uoe1xuICogICAgICAgICAgICAgICBwYXJ0czogZmlsZXMubWFwKGZ1bmN0aW9uKGZpbGUpIHtcbiAqICAgICAgICAgICAgICAgICAgcmV0dXJuIG5ldyBsYXllci5NZXNzYWdlUGFydCh7Ym9keTogZmlsZSwgbWltZVR5cGU6IGZpbGUudHlwZX0pO1xuICogICAgICAgICAgICAgICB9XG4gKiAgICAgICAgICAgfSk7XG4gKiAgICAgIH0pO1xuICpcbiAqICMjIyBCbG9icyB2cyBTdHJpbmdzXG4gKlxuICogWW91IHNob3VsZCBhbHdheXMgZXhwZWN0IHRvIHNlZSB0aGUgYGJvZHlgIHByb3BlcnR5IGJlIGEgQmxvYiAqKnVubGVzcyoqIHRoZSBtaW1lVHlwZSBpcyBsaXN0ZWQgaW4gbGF5ZXIuTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlcyxcbiAqIGluIHdoaWNoIGNhc2UgdGhlIHZhbHVlIHdpbGwgYmUgYSBTdHJpbmcuICBZb3UgY2FuIGFkZCBtaW1lVHlwZXMgdG8gVGV4dHVhbE1pbWVUeXBlczpcbiAqXG4gKiBgYGBcbiAqIGxheWVyLk1lc3NhZ2VQYXJ0LlRleHR1YWxNaW1lVHlwZXMgPSBbJ3RleHQvcGxhaW4nLCAndGV4dC9tb3VudGFpbicsIC9eYXBwbGljYXRpb25cXC9qc29uKFxcKy4rKSQvXVxuICogYGBgXG4gKlxuICogQW55IG1pbWVUeXBlIG1hdGNoaW5nIHRoZSBhYm92ZSBzdHJpbmdzIGFuZCByZWd1bGFyIGV4cHJlc3Npb25zIHdpbGwgYmUgdHJhbnNmb3JtZWQgdG8gdGV4dCBiZWZvcmUgYmVpbmcgZGVsaXZlcmVkIHRvIHlvdXIgYXBwOyBvdGhlcndpc2UgaXQgbXVzdCBiZSBhIEJsb2IuXG4gKlxuICogIyMjIEFjY2VzaW5nIFJpY2ggQ29udGVudFxuICpcbiAqIFRoZXJlIGFyZSB0d28gd2F5cyBvZiBhY2Nlc3NpbmcgcmljaCBjb250ZW50XG4gKlxuICogMS4gQWNjZXNzIHRoZSBkYXRhIGRpcmVjdGx5OiBgcGFydC5mZXRjaENvbnRlbnQoZnVuY3Rpb24oZGF0YSkge215UmVuZGVyRGF0YShkYXRhKTt9KWAuIFRoaXMgYXBwcm9hY2ggZG93bmxvYWRzIHRoZSBkYXRhLFxuICogICAgd3JpdGVzIGl0IHRvIHRoZSB0aGUgYGJvZHlgIHByb3BlcnR5LCB3cml0ZXMgYSBEYXRhIFVSSSB0byB0aGUgcGFydCdzIGB1cmxgIHByb3BlcnR5LCBhbmQgdGhlbiBjYWxscyB5b3VyIGNhbGxiYWNrLlxuICogICAgQnkgZG93bmxvYWRpbmcgdGhlIGRhdGEgYW5kIHN0b3JpbmcgaXQgaW4gYGJvZHlgLCB0aGUgZGF0YSBkb2VzIG5vdCBleHBpcmUuXG4gKiAyLiBBY2Nlc3MgdGhlIFVSTCByYXRoZXIgdGhhbiB0aGUgZGF0YS4gIFdoZW4geW91IGZpcnN0IHJlY2VpdmUgdGhlIE1lc3NhZ2UgUGFydCBpdCB3aWxsIGhhdmUgYSB2YWxpZCBgdXJsYCBwcm9wZXJ0eTsgaG93ZXZlciwgdGhpcyBVUkwgZXhwaXJlcy4gICogICAgVVJMcyBhcmUgbmVlZGVkIGZvciBzdHJlYW1pbmcsIGFuZCBmb3IgY29udGVudCB0aGF0IGRvZXNuJ3QgeWV0IG5lZWQgdG8gYmUgcmVuZGVyZWQgKGUuZy4gaHlwZXJsaW5rcyB0byBkYXRhIHRoYXQgd2lsbCByZW5kZXIgd2hlbiBjbGlja2VkKS5cbiAqICAgIFRoZSB1cmwgcHJvcGVydHkgd2lsbCByZXR1cm4gYSBzdHJpbmcgaWYgdGhlIHVybCBpcyB2YWxpZCwgb3IgJycgaWYgaXRzIGV4cGlyZWQuICBDYWxsIGBwYXJ0LmZldGNoU3RyZWFtKGNhbGxiYWNrKWAgdG8gZ2V0IGFuIHVwZGF0ZWQgVVJMLlxuICogICAgVGhlIGZvbGxvd2luZyBwYXR0ZXJuIGlzIHJlY29tbWVuZGVkOlxuICpcbiAqIGBgYFxuICogaWYgKCFwYXJ0LnVybCkge1xuICogICBwYXJ0LmZldGNoU3RyZWFtKGZ1bmN0aW9uKHVybCkge215UmVuZGVyVXJsKHVybCl9KTtcbiAqIH0gZWxzZSB7XG4gKiAgIG15UmVuZGVyVXJsKHBhcnQudXJsKTtcbiAqIH1cbiAqIGBgYFxuICpcbiAqIE5PVEU6IGBsYXllci5NZXNzYWdlUGFydC51cmxgIHNob3VsZCBoYXZlIGEgdmFsdWUgd2hlbiB0aGUgbWVzc2FnZSBpcyBmaXJzdCByZWNlaXZlZCwgYW5kIHdpbGwgb25seSBmYWlsIGBpZiAoIXBhcnQudXJsKWAgb25jZSB0aGUgdXJsIGhhcyBleHBpcmVkLlxuICpcbiAqIEBjbGFzcyAgbGF5ZXIuTWVzc2FnZVBhcnRcbiAqIEBleHRlbmRzIGxheWVyLlJvb3RcbiAqIEBhdXRob3IgTWljaGFlbCBLYW50b3JcbiAqL1xuXG5jb25zdCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG5jb25zdCBDb250ZW50ID0gcmVxdWlyZSgnLi9jb250ZW50Jyk7XG5jb25zdCB4aHIgPSByZXF1aXJlKCcuL3hocicpO1xuY29uc3QgQ2xpZW50UmVnaXN0cnkgPSByZXF1aXJlKCcuL2NsaWVudC1yZWdpc3RyeScpO1xuY29uc3QgTGF5ZXJFcnJvciA9IHJlcXVpcmUoJy4vbGF5ZXItZXJyb3InKTtcbmNvbnN0IFV0aWwgPSByZXF1aXJlKCcuL2NsaWVudC11dGlscycpO1xuY29uc3QgbG9nZ2VyID0gcmVxdWlyZSgnLi9sb2dnZXInKTtcblxuY2xhc3MgTWVzc2FnZVBhcnQgZXh0ZW5kcyBSb290IHtcblxuICAvKipcbiAgICogQ29uc3RydWN0b3JcbiAgICpcbiAgICogQG1ldGhvZCBjb25zdHJ1Y3RvclxuICAgKiBAcGFyYW0gIHtPYmplY3R9IG9wdGlvbnMgLSBDYW4gYmUgYW4gb2JqZWN0IHdpdGggYm9keSBhbmQgbWltZVR5cGUsIG9yIGl0IGNhbiBiZSBhIHN0cmluZywgb3IgYSBCbG9iL0ZpbGVcbiAgICogQHBhcmFtICB7c3RyaW5nfSBvcHRpb25zLmJvZHkgLSBBbnkgc3RyaW5nIGxhcmdlciB0aGFuIDJrYiB3aWxsIGJlIHNlbnQgYXMgUmljaCBDb250ZW50LCBtZWFuaW5nIGl0IHdpbGwgYmUgdXBsb2FkZWQgdG8gY2xvdWQgc3RvcmFnZSBhbmQgbXVzdCBiZSBzZXBhcmF0ZWx5IGRvd25sb2FkZWQgZnJvbSB0aGUgTWVzc2FnZSB3aGVuIGl0cyByZWNlaXZlZC5cbiAgICogQHBhcmFtICB7c3RyaW5nfSBbb3B0aW9ucy5taW1lVHlwZT10ZXh0L3BsYWluXSAtIE1pbWUgdHlwZTsgY2FuIGJlIGFueXRoaW5nOyBpZiB5b3VyIGNsaWVudCBkb2Vzbid0IGhhdmUgYSByZW5kZXJlciBmb3IgaXQsIGl0IHdpbGwgYmUgaWdub3JlZC5cbiAgICogQHBhcmFtICB7bnVtYmVyfSBbb3B0aW9ucy5zaXplPTBdIC0gU2l6ZSBvZiB5b3VyIHBhcnQuIFdpbGwgYmUgY2FsY3VsYXRlZCBmb3IgeW91IGlmIG5vdCBwcm92aWRlZC5cbiAgICpcbiAgICogQHJldHVybiB7bGF5ZXIuTWVzc2FnZVBhcnR9XG4gICAqL1xuICBjb25zdHJ1Y3RvcihvcHRpb25zLCAuLi5hcmdzKSB7XG4gICAgbGV0IG5ld09wdGlvbnMgPSBvcHRpb25zO1xuICAgIGlmICh0eXBlb2Ygb3B0aW9ucyA9PT0gJ3N0cmluZycpIHtcbiAgICAgIG5ld09wdGlvbnMgPSB7IGJvZHk6IG9wdGlvbnMgfTtcbiAgICAgIGlmIChhcmdzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgbmV3T3B0aW9ucy5taW1lVHlwZSA9IGFyZ3NbMF07XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBuZXdPcHRpb25zLm1pbWVUeXBlID0gJ3RleHQvcGxhaW4nO1xuICAgICAgfVxuICAgIH0gZWxzZSBpZiAoVXRpbC5pc0Jsb2Iob3B0aW9ucykgfHwgVXRpbC5pc0Jsb2Iob3B0aW9ucy5ib2R5KSkge1xuICAgICAgY29uc3QgYm9keSA9IG9wdGlvbnMgaW5zdGFuY2VvZiBCbG9iID8gb3B0aW9ucyA6IG9wdGlvbnMuYm9keTtcbiAgICAgIGNvbnN0IG1pbWVUeXBlID0gVXRpbC5pc0Jsb2Iob3B0aW9ucy5ib2R5KSA/IG9wdGlvbnMubWltZVR5cGUgOiBib2R5LnR5cGU7XG4gICAgICBuZXdPcHRpb25zID0ge1xuICAgICAgICBtaW1lVHlwZSxcbiAgICAgICAgYm9keSxcbiAgICAgICAgc2l6ZTogYm9keS5zaXplLFxuICAgICAgICBoYXNDb250ZW50OiB0cnVlLFxuICAgICAgfTtcbiAgICB9XG4gICAgc3VwZXIobmV3T3B0aW9ucyk7XG4gICAgaWYgKCF0aGlzLnNpemUgJiYgdGhpcy5ib2R5KSB0aGlzLnNpemUgPSB0aGlzLmJvZHkubGVuZ3RoO1xuXG4gICAgLy8gRG9uJ3QgZXhwb3NlIGVuY29kaW5nOyBibG9iaWZ5IGl0IGlmIGl0cyBlbmNvZGVkLlxuICAgIGlmIChvcHRpb25zLmVuY29kaW5nID09PSAnYmFzZTY0Jykge1xuICAgICAgdGhpcy5ib2R5ID0gVXRpbC5iYXNlNjRUb0Jsb2IodGhpcy5ib2R5KTtcbiAgICB9XG5cbiAgICAvLyBDb3VsZCBiZSBhIGJsb2IgYmVjYXVzZSBpdCB3YXMgcmVhZCBvdXQgb2YgaW5kZXhlZERCLFxuICAgIC8vIG9yIGJlY2F1c2UgaXQgd2FzIGNyZWF0ZWQgbG9jYWxseSB3aXRoIGEgZmlsZVxuICAgIC8vIE9yIGJlY2F1c2Ugb2YgYmFzZTY0IGVuY29kZWQgZGF0YS5cbiAgICBjb25zdCBpc0Jsb2JCb2R5ID0gVXRpbC5pc0Jsb2IodGhpcy5ib2R5KTtcbiAgICBjb25zdCB0ZXh0dWFsID0gdGhpcy5pc1RleHR1YWxNaW1lVHlwZSgpO1xuXG4gICAgLy8gQ3VzdG9tIGhhbmRsaW5nIGZvciBub24tdGV4dHVhbCBjb250ZW50XG4gICAgaWYgKCF0ZXh0dWFsKSB7XG4gICAgICAvLyBJZiB0aGUgYm9keSBleGlzdHMgYW5kIGlzIGEgYmxvYiwgZXh0cmFjdCB0aGUgZGF0YSB1cmkgZm9yIGNvbnZlbmllbmNlOyBvbmx5IHJlYWxseSByZWxldmFudCBmb3IgaW1hZ2UgYW5kIHZpZGVvIEhUTUwgdGFncy5cbiAgICAgIGlmICghaXNCbG9iQm9keSAmJiB0aGlzLmJvZHkpIHRoaXMuYm9keSA9IG5ldyBCbG9iKFt0aGlzLmJvZHldLCB7IHR5cGU6IHRoaXMubWltZVR5cGUgfSk7XG4gICAgICBpZiAodGhpcy5ib2R5KSB0aGlzLnVybCA9IFVSTC5jcmVhdGVPYmplY3RVUkwodGhpcy5ib2R5KTtcbiAgICB9XG5cbiAgICAvLyBJZiBvdXIgdGV4dHVhbCBjb250ZW50IGlzIGEgYmxvYiwgdHVybmluZyBpdCBpbnRvIHRleHQgaXMgYXN5Y2hyb25vdXMsIGFuZCBjYW4ndCBiZSBkb25lIGluIHRoZSBzeW5jaHJvbm91cyBjb25zdHJ1Y3RvclxuICAgIC8vIFRoaXMgd2lsbCBvbmx5IGhhcHBlbiB3aGVuIHRoZSBjbGllbnQgaXMgYXR0YWNoaW5nIGEgZmlsZS4gIENvbnZlcnNpb24gZm9yIGxvY2FsbHkgY3JlYXRlZCBtZXNzYWdlcyBpcyBkb25lIHdoaWxlIGNhbGxpbmcgYE1lc3NhZ2Uuc2VuZCgpYFxuICB9XG5cblxuXG4gIGRlc3Ryb3koKSB7XG4gICAgaWYgKHRoaXMuX191cmwpIHtcbiAgICAgIFVSTC5yZXZva2VPYmplY3RVUkwodGhpcy5fX3VybCk7XG4gICAgICB0aGlzLl9fdXJsID0gbnVsbDtcbiAgICB9XG4gICAgdGhpcy5ib2R5ID0gbnVsbDtcbiAgICBzdXBlci5kZXN0cm95KCk7XG4gIH1cblxuICAvKipcbiAgICogR2V0IHRoZSBsYXllci5DbGllbnQgYXNzb2NpYXRlZCB3aXRoIHRoaXMgbGF5ZXIuTWVzc2FnZVBhcnQuXG4gICAqXG4gICAqIFVzZXMgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LmNsaWVudElkIHByb3BlcnR5LlxuICAgKlxuICAgKiBAbWV0aG9kIF9nZXRDbGllbnRcbiAgICogQHByaXZhdGVcbiAgICogQHJldHVybiB7bGF5ZXIuQ2xpZW50fVxuICAgKi9cbiAgX2dldENsaWVudCgpIHtcbiAgICByZXR1cm4gQ2xpZW50UmVnaXN0cnkuZ2V0KHRoaXMuY2xpZW50SWQpO1xuICB9XG5cbiAgLyoqXG4gICAqIEdldCB0aGUgbGF5ZXIuTWVzc2FnZSBhc3NvY2lhdGVkIHdpdGggdGhpcyBsYXllci5NZXNzYWdlUGFydC5cbiAgICpcbiAgICogQG1ldGhvZCBfZ2V0TWVzc2FnZVxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcmV0dXJuIHtsYXllci5NZXNzYWdlfVxuICAgKi9cbiAgX2dldE1lc3NhZ2UoKSB7XG4gICAgcmV0dXJuIHRoaXMuX2dldENsaWVudCgpLmdldE1lc3NhZ2UodGhpcy5pZC5yZXBsYWNlKC9cXC9wYXJ0cy4qJC8sICcnKSk7XG4gIH1cblxuICAvKipcbiAgICogRG93bmxvYWQgUmljaCBDb250ZW50IGZyb20gY2xvdWQgc2VydmVyLlxuICAgKlxuICAgKiBGb3IgTWVzc2FnZVBhcnRzIHdpdGggcmljaCBjb250ZW50LCB0aGlzIG1ldGhvZCB3aWxsIGxvYWQgdGhlIGRhdGEgZnJvbSBnb29nbGUncyBjbG91ZCBzdG9yYWdlLlxuICAgKiBUaGUgYm9keSBwcm9wZXJ0eSBvZiB0aGlzIE1lc3NhZ2VQYXJ0IGlzIHNldCB0byB0aGUgcmVzdWx0LlxuICAgKlxuICAgKiAgICAgIG1lc3NhZ2VwYXJ0LmZldGNoQ29udGVudCgpXG4gICAqICAgICAgLm9uKFwiY29udGVudC1sb2FkZWRcIiwgZnVuY3Rpb24oKSB7XG4gICAqICAgICAgICAgIHJlbmRlcihtZXNzYWdlcGFydC5ib2R5KTtcbiAgICogICAgICB9KTtcbiAgICpcbiAgICogTm90ZSB0aGF0IGEgc3VjY2Vzc2Z1bCBjYWxsIHRvIGBmZXRjaENvbnRlbnRgIHdpbGwgYWxzbyBjYXVzZSBRdWVyeSBjaGFuZ2UgZXZlbnRzIHRvIGZpcmUuXG4gICAqIEluIHRoaXMgZXhhbXBsZSwgYHJlbmRlcmAgd2lsbCBiZSBjYWxsZWQgYnkgdGhlIHF1ZXJ5IGNoYW5nZSBldmVudCB0aGF0IHdpbGwgb2NjdXIgb25jZSB0aGUgY29udGVudCBoYXMgZG93bmxvYWRlZDpcbiAgICpcbiAgICogYGBgXG4gICAqICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgIHJlbmRlcihxdWVyeS5kYXRhKTtcbiAgICogIH0pO1xuICAgKiAgbWVzc2FnZXBhcnQuZmV0Y2hDb250ZW50KCk7XG4gICAqIGBgYFxuICAgKlxuICAgKlxuICAgKiBAbWV0aG9kIGZldGNoQ29udGVudFxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGNhbGxiYWNrLmRhdGEgLSBFaXRoZXIgYSBzdHJpbmcgKG1pbWVUeXBlPXRleHQvcGxhaW4pIG9yIGEgQmxvYiAoYWxsIG90aGVyIG1pbWVUeXBlcylcbiAgICogQHJldHVybiB7bGF5ZXIuQ29udGVudH0gdGhpc1xuICAgKi9cbiAgZmV0Y2hDb250ZW50KGNhbGxiYWNrKSB7XG4gICAgaWYgKHRoaXMuX2NvbnRlbnQgJiYgIXRoaXMuaXNGaXJpbmcpIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSB0cnVlO1xuICAgICAgY29uc3QgdHlwZSA9IHRoaXMubWltZVR5cGUgPT09ICdpbWFnZS9qcGVnK3ByZXZpZXcnID8gJ2ltYWdlL2pwZWcnIDogdGhpcy5taW1lVHlwZTtcbiAgICAgIHRoaXMuX2NvbnRlbnQubG9hZENvbnRlbnQodHlwZSwgKGVyciwgcmVzdWx0KSA9PiB0aGlzLl9mZXRjaENvbnRlbnRDYWxsYmFjayhlcnIsIHJlc3VsdCwgY2FsbGJhY2spKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXM7XG4gIH1cblxuXG4gIC8qKlxuICAgKiBDYWxsYmFjayB3aXRoIHJlc3VsdCBvciBlcnJvciBmcm9tIGNhbGxpbmcgZmV0Y2hDb250ZW50LlxuICAgKlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAbWV0aG9kIF9mZXRjaENvbnRlbnRDYWxsYmFja1xuICAgKiBAcGFyYW0ge2xheWVyLkxheWVyRXJyb3J9IGVyclxuICAgKiBAcGFyYW0ge09iamVjdH0gcmVzdWx0XG4gICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAqL1xuICBfZmV0Y2hDb250ZW50Q2FsbGJhY2soZXJyLCByZXN1bHQsIGNhbGxiYWNrKSB7XG4gICAgaWYgKGVycikge1xuICAgICAgdGhpcy50cmlnZ2VyKCdjb250ZW50LWxvYWRlZC1lcnJvcicsIGVycik7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuaXNGaXJpbmcgPSBmYWxzZTtcbiAgICAgIGlmICh0aGlzLmlzVGV4dHVhbE1pbWVUeXBlKCkpIHtcbiAgICAgICAgVXRpbC5mZXRjaFRleHRGcm9tRmlsZShyZXN1bHQsIHRleHQgPT4gdGhpcy5fZmV0Y2hDb250ZW50Q29tcGxldGUodGV4dCwgY2FsbGJhY2spKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMudXJsID0gVVJMLmNyZWF0ZU9iamVjdFVSTChyZXN1bHQpO1xuICAgICAgICB0aGlzLl9mZXRjaENvbnRlbnRDb21wbGV0ZShyZXN1bHQsIGNhbGxiYWNrKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogQ2FsbGJhY2sgd2l0aCBQYXJ0IEJvZHkgZnJvbSBfZmV0Y2hDb250ZW50Q2FsbGJhY2suXG4gICAqXG4gICAqIEBwcml2YXRlXG4gICAqIEBtZXRob2QgX2ZldGNoQ29udGVudENvbXBsZXRlXG4gICAqIEBwYXJhbSB7QmxvYnxTdHJpbmd9IGJvZHlcbiAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICovXG4gIF9mZXRjaENvbnRlbnRDb21wbGV0ZShib2R5LCBjYWxsYmFjaykge1xuICAgIGNvbnN0IG1lc3NhZ2UgPSB0aGlzLl9nZXRNZXNzYWdlKCk7XG5cbiAgICB0aGlzLmJvZHkgPSBib2R5O1xuXG4gICAgdGhpcy50cmlnZ2VyKCdjb250ZW50LWxvYWRlZCcpO1xuICAgIG1lc3NhZ2UuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgb2xkVmFsdWU6IG1lc3NhZ2UucGFydHMsXG4gICAgICBuZXdWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIHByb3BlcnR5OiAncGFydHMnLFxuICAgIH0pO1xuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sodGhpcy5ib2R5KTtcbiAgfVxuXG5cbiAgLyoqXG4gICAqIEFjY2VzcyB0aGUgVVJMIHRvIHRoZSByZW1vdGUgcmVzb3VyY2UuXG4gICAqXG4gICAqIFVzZWZ1bCBmb3Igc3RyZWFtaW5nIHRoZSBjb250ZW50IHNvIHRoYXQgeW91IGRvbid0IGhhdmUgdG8gZG93bmxvYWQgdGhlIGVudGlyZSBmaWxlIGJlZm9yZSByZW5kZXJpbmcgaXQuXG4gICAqIEFsc28gdXNlZnVsIGZvciBjb250ZW50IHRoYXQgd2lsbCBiZSBvcGVubmVkIGluIGEgbmV3IHdpbmRvdywgYW5kIGRvZXMgbm90IG5lZWQgdG8gYmUgZmV0Y2hlZCBub3cuXG4gICAqXG4gICAqIEZvciBNZXNzYWdlUGFydHMgd2l0aCBSaWNoIENvbnRlbnQsIHdpbGwgbG9va3VwIGEgVVJMIHRvIHlvdXIgUmljaCBDb250ZW50LlxuICAgKiBVc2VmdWwgZm9yIHN0cmVhbWluZyBhbmQgY29udGVudCBzbyB0aGF0IHlvdSBkb24ndCBoYXZlIHRvIGRvd25sb2FkIHRoZSBlbnRpcmUgZmlsZSBiZWZvcmUgcmVuZGVyaW5nIGl0LlxuICAgKlxuICAgKiBgYGBcbiAgICogbWVzc2FnZXBhcnQuZmV0Y2hTdHJlYW0oZnVuY3Rpb24odXJsKSB7XG4gICAqICAgICByZW5kZXIodXJsKTtcbiAgICogfSk7XG4gICAqIGBgYFxuICAgKlxuICAgKiBOb3RlIHRoYXQgYSBzdWNjZXNzZnVsIGNhbGwgdG8gYGZldGNoU3RyZWFtYCB3aWxsIGFsc28gY2F1c2UgUXVlcnkgY2hhbmdlIGV2ZW50cyB0byBmaXJlLlxuICAgKiBJbiB0aGlzIGV4YW1wbGUsIGByZW5kZXJgIHdpbGwgYmUgY2FsbGVkIGJ5IHRoZSBxdWVyeSBjaGFuZ2UgZXZlbnQgdGhhdCB3aWxsIG9jY3VyIG9uY2UgdGhlIGB1cmxgIGhhcyBiZWVuIHJlZnJlc2hlZDpcbiAgICpcbiAgICogYGBgXG4gICAqICBxdWVyeS5vbignY2hhbmdlJywgZnVuY3Rpb24oZXZ0KSB7XG4gICAqICAgICAgcmVuZGVyKHF1ZXJ5LmRhdGEpO1xuICAgKiAgfSk7XG4gICAqICBtZXNzYWdlcGFydC5mZXRjaFN0cmVhbSgpO1xuICAgKiBgYGBcbiAgICpcbiAgICogQG1ldGhvZCBmZXRjaFN0cmVhbVxuICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBbY2FsbGJhY2tdXG4gICAqIEBwYXJhbSB7TWl4ZWR9IGNhbGxiYWNrLnVybFxuICAgKiBAcmV0dXJuIHtsYXllci5Db250ZW50fSB0aGlzXG4gICAqL1xuICBmZXRjaFN0cmVhbShjYWxsYmFjaykge1xuICAgIGlmICghdGhpcy5fY29udGVudCkgdGhyb3cgbmV3IEVycm9yKExheWVyRXJyb3IuZGljdGlvbmFyeS5jb250ZW50UmVxdWlyZWQpO1xuICAgIGlmICh0aGlzLl9jb250ZW50LmlzRXhwaXJlZCgpKSB7XG4gICAgICB0aGlzLl9jb250ZW50LnJlZnJlc2hDb250ZW50KHRoaXMuX2dldENsaWVudCgpLCB1cmwgPT4gdGhpcy5fZmV0Y2hTdHJlYW1Db21wbGV0ZSh1cmwsIGNhbGxiYWNrKSk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMuX2ZldGNoU3RyZWFtQ29tcGxldGUodGhpcy5fY29udGVudC5kb3dubG9hZFVybCwgY2FsbGJhY2spO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcztcbiAgfVxuXG4gIC8vIERvZXMgbm90IHNldCB0aGlzLnVybDsgaW5zdGVhZCByZWxpZXMgb24gZmFjdCB0aGF0IHRoaXMuX2NvbnRlbnQuZG93bmxvYWRVcmwgaGFzIGJlZW4gdXBkYXRlZFxuICBfZmV0Y2hTdHJlYW1Db21wbGV0ZSh1cmwsIGNhbGxiYWNrKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IHRoaXMuX2dldE1lc3NhZ2UoKTtcblxuICAgIHRoaXMudHJpZ2dlcigndXJsLWxvYWRlZCcpO1xuICAgIG1lc3NhZ2UuX3RyaWdnZXJBc3luYygnbWVzc2FnZXM6Y2hhbmdlJywge1xuICAgICAgb2xkVmFsdWU6IG1lc3NhZ2UucGFydHMsXG4gICAgICBuZXdWYWx1ZTogbWVzc2FnZS5wYXJ0cyxcbiAgICAgIHByb3BlcnR5OiAncGFydHMnLFxuICAgIH0pO1xuICAgIGlmIChjYWxsYmFjaykgY2FsbGJhY2sodXJsKTtcbiAgfVxuXG4gIC8qKlxuICAgKiBQcmVwcyBhIE1lc3NhZ2VQYXJ0IGZvciBzZW5kaW5nLiAgTm9ybWFsbHkgdGhhdCBpcyB0cml2aWFsLlxuICAgKiBCdXQgaWYgdGhlcmUgaXMgcmljaCBjb250ZW50LCB0aGVuIHRoZSBjb250ZW50IG11c3QgYmUgdXBsb2FkZWRcbiAgICogYW5kIHRoZW4gd2UgY2FuIHRyaWdnZXIgYSBcInBhcnRzOnNlbmRcIiBldmVudCBpbmRpY2F0aW5nIHRoYXRcbiAgICogdGhlIHBhcnQgaXMgcmVhZHkgdG8gc2VuZC5cbiAgICpcbiAgICogQG1ldGhvZCBfc2VuZFxuICAgKiBAcHJvdGVjdGVkXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqIEBmaXJlcyBwYXJ0czpzZW5kXG4gICAqL1xuICBfc2VuZFBhcnQoY2xpZW50KSB7XG4gICAgLy8gVGhlcmUgaXMgYWxyZWFkeSBhIENvbnRlbnQgb2JqZWN0LCBwcmVzdW1hYmx5IHRoZSBkZXZlbG9wZXJcbiAgICAvLyBhbHJlYWR5IHRvb2sgY2FyZSBvZiB0aGlzIHN0ZXAgZm9yIHVzLlxuICAgIGlmICh0aGlzLl9jb250ZW50KSB7XG4gICAgICB0aGlzLl9zZW5kV2l0aENvbnRlbnQoKTtcbiAgICB9XG5cbiAgICAvLyBJZiB0aGUgc2l6ZSBpcyBsYXJnZSwgQ3JlYXRlIGFuZCB1cGxvYWQgdGhlIENvbnRlbnRcbiAgICBlbHNlIGlmICh0aGlzLnNpemUgPiAyMDQ4KSB7XG4gICAgICB0aGlzLl9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kKGNsaWVudCk7XG4gICAgfVxuXG4gICAgLy8gSWYgdGhlIGJvZHkgaXMgYSBibG9iLCBidXQgaXMgbm90IFlFVCBSaWNoIENvbnRlbnQsIGRvIHNvbWUgY3VzdG9tIGFuYWx5c2lzL3Byb2Nlc3Npbmc6XG4gICAgZWxzZSBpZiAoVXRpbC5pc0Jsb2IodGhpcy5ib2R5KSkge1xuICAgICAgdGhpcy5fc2VuZEJsb2IoY2xpZW50KTtcbiAgICB9XG5cbiAgICAvLyBFbHNlIHRoZSBtZXNzYWdlIHBhcnQgY2FuIGJlIHNlbnQgYXMgaXMuXG4gICAgZWxzZSB7XG4gICAgICB0aGlzLl9zZW5kQm9keSgpO1xuICAgIH1cbiAgfVxuXG4gIF9zZW5kKCkge1xuICAgIGlmICh0eXBlb2YgdGhpcy5sYXp5UmVzb2x2ZSA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgdGhpcy5sYXp5UmVzb2x2ZSh0aGlzLCAocmVzdWx0KSA9PiB7XG4gICAgICAgIE9iamVjdC5hc3NpZ24odGhpcywgcmVzdWx0KTtcbiAgICAgICAgdGhpcy5fc2VuZFBhcnQoY2xpZW50KTtcbiAgICAgIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLl9zZW5kUGFydChjbGllbnQpO1xuICAgIH1cbiAgfVxuXG4gIF9zZW5kQm9keSgpIHtcbiAgICBpZiAodHlwZW9mIHRoaXMuYm9keSAhPT0gJ3N0cmluZycpIHtcbiAgICAgIGNvbnN0IGVyciA9ICdNZXNzYWdlUGFydC5ib2R5IG11c3QgYmUgYSBzdHJpbmcgaW4gb3JkZXIgdG8gc2VuZCBpdCc7XG4gICAgICBsb2dnZXIuZXJyb3IoZXJyLCB7IG1pbWVUeXBlOiB0aGlzLm1pbWVUeXBlLCBib2R5OiB0aGlzLmJvZHkgfSk7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoZXJyKTtcbiAgICB9XG5cbiAgICBjb25zdCBvYmogPSB7XG4gICAgICBtaW1lX3R5cGU6IHRoaXMubWltZVR5cGUsXG4gICAgICBib2R5OiB0aGlzLmJvZHksXG4gICAgfTtcbiAgICB0aGlzLnRyaWdnZXIoJ3BhcnRzOnNlbmQnLCBvYmopO1xuICB9XG5cbiAgX3NlbmRXaXRoQ29udGVudCgpIHtcbiAgICB0aGlzLnRyaWdnZXIoJ3BhcnRzOnNlbmQnLCB7XG4gICAgICBtaW1lX3R5cGU6IHRoaXMubWltZVR5cGUsXG4gICAgICBjb250ZW50OiB7XG4gICAgICAgIHNpemU6IHRoaXMuc2l6ZSxcbiAgICAgICAgaWQ6IHRoaXMuX2NvbnRlbnQuaWQsXG4gICAgICB9LFxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIFRoaXMgbWV0aG9kIGlzIG9ubHkgY2FsbGVkIGlmIEJsb2Iuc2l6ZSA8IDIwNDguXG4gICAqXG4gICAqIEhvd2V2ZXIsIGNvbnZlcnNpb24gdG8gYmFzZTY0IGNhbiBpbXBhY3QgdGhlIHNpemUsIHNvIHdlIG11c3QgcmV0ZXN0IHRoZSBzaXplXG4gICAqIGFmdGVyIGNvbnZlcnNpb24sIGFuZCB0aGVuIGRlY2lkZSB0byBzZW5kIHRoZSBvcmlnaW5hbCBibG9iIG9yIHRoZSBiYXNlNjQgZW5jb2RlZCBkYXRhLlxuICAgKlxuICAgKiBAbWV0aG9kIF9zZW5kQmxvYlxuICAgKiBAcHJpdmF0ZVxuICAgKiBAcGFyYW0ge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqL1xuICBfc2VuZEJsb2IoY2xpZW50KSB7XG4gICAgLyogaXN0YW5idWwgaWdub3JlIGVsc2UgKi9cbiAgICBVdGlsLmJsb2JUb0Jhc2U2NCh0aGlzLmJvZHksIChiYXNlNjRkYXRhKSA9PiB7XG4gICAgICBpZiAoYmFzZTY0ZGF0YS5sZW5ndGggPCAyMDQ4KSB7XG4gICAgICAgIGNvbnN0IGJvZHkgPSBiYXNlNjRkYXRhLnN1YnN0cmluZyhiYXNlNjRkYXRhLmluZGV4T2YoJywnKSArIDEpO1xuICAgICAgICBjb25zdCBvYmogPSB7XG4gICAgICAgICAgYm9keSxcbiAgICAgICAgICBtaW1lX3R5cGU6IHRoaXMubWltZVR5cGUsXG4gICAgICAgIH07XG4gICAgICAgIG9iai5lbmNvZGluZyA9ICdiYXNlNjQnO1xuICAgICAgICB0aGlzLnRyaWdnZXIoJ3BhcnRzOnNlbmQnLCBvYmopO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgdGhpcy5fZ2VuZXJhdGVDb250ZW50QW5kU2VuZChjbGllbnQpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZSBhbiByaWNoIENvbnRlbnQgb2JqZWN0IG9uIHRoZSBzZXJ2ZXJcbiAgICogYW5kIHRoZW4gY2FsbCBfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZVxuICAgKlxuICAgKiBAbWV0aG9kIF9nZW5lcmF0ZUNvbnRlbnRBbmRTZW5kXG4gICAqIEBwcml2YXRlXG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqL1xuICBfZ2VuZXJhdGVDb250ZW50QW5kU2VuZChjbGllbnQpIHtcbiAgICB0aGlzLmhhc0NvbnRlbnQgPSB0cnVlO1xuICAgIGxldCBib2R5O1xuICAgIGlmICghVXRpbC5pc0Jsb2IodGhpcy5ib2R5KSkge1xuICAgICAgYm9keSA9IFV0aWwuYmFzZTY0VG9CbG9iKFV0aWwudXRvYSh0aGlzLmJvZHkpLCB0aGlzLm1pbWVUeXBlKTtcbiAgICB9IGVsc2Uge1xuICAgICAgYm9keSA9IHRoaXMuYm9keTtcbiAgICB9XG4gICAgY2xpZW50Lnhocih7XG4gICAgICB1cmw6ICcvY29udGVudCcsXG4gICAgICBtZXRob2Q6ICdQT1NUJyxcbiAgICAgIGhlYWRlcnM6IHtcbiAgICAgICAgJ1VwbG9hZC1Db250ZW50LVR5cGUnOiB0aGlzLm1pbWVUeXBlLFxuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtTGVuZ3RoJzogYm9keS5zaXplLFxuICAgICAgICAnVXBsb2FkLU9yaWdpbic6IHR5cGVvZiBsb2NhdGlvbiAhPT0gJ3VuZGVmaW5lZCcgPyBsb2NhdGlvbi5vcmlnaW4gOiAnJyxcbiAgICAgIH0sXG4gICAgICBzeW5jOiB7fSxcbiAgICB9LCByZXN1bHQgPT4ge1xuICAgICAgdGhpcy5fcHJvY2Vzc0NvbnRlbnRSZXNwb25zZShyZXN1bHQuZGF0YSwgYm9keSwgY2xpZW50KTtcbiAgICB9KTtcbiAgfVxuXG4gIC8qKlxuICAgKiBDcmVhdGVzIGEgbGF5ZXIuQ29udGVudCBvYmplY3QgZnJvbSB0aGUgc2VydmVyJ3NcbiAgICogQ29udGVudCBvYmplY3QsIGFuZCB0aGVuIHVwbG9hZHMgdGhlIGRhdGEgdG8gZ29vZ2xlIGNsb3VkIHN0b3JhZ2UuXG4gICAqXG4gICAqIEBtZXRob2QgX3Byb2Nlc3NDb250ZW50UmVzcG9uc2VcbiAgICogQHByaXZhdGVcbiAgICogQHBhcmFtICB7T2JqZWN0fSByZXNwb25zZVxuICAgKiBAcGFyYW0gIHtCbG9ifSBib2R5XG4gICAqIEBwYXJhbSAge2xheWVyLkNsaWVudH0gY2xpZW50XG4gICAqL1xuICBfcHJvY2Vzc0NvbnRlbnRSZXNwb25zZShyZXNwb25zZSwgYm9keSwgY2xpZW50KSB7XG4gICAgdGhpcy5fY29udGVudCA9IG5ldyBDb250ZW50KHJlc3BvbnNlLmlkKTtcbiAgICB0aGlzLmhhc0NvbnRlbnQgPSB0cnVlO1xuXG4gICAgeGhyKHtcbiAgICAgIHVybDogcmVzcG9uc2UudXBsb2FkX3VybCxcbiAgICAgIG1ldGhvZDogJ1BVVCcsXG4gICAgICBkYXRhOiBib2R5LFxuICAgICAgaGVhZGVyczoge1xuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtTGVuZ3RoJzogdGhpcy5zaXplLFxuICAgICAgICAnVXBsb2FkLUNvbnRlbnQtVHlwZSc6IHRoaXMubWltZVR5cGUsXG4gICAgICB9LFxuICAgIH0sIHJlc3VsdCA9PiB0aGlzLl9wcm9jZXNzQ29udGVudFVwbG9hZFJlc3BvbnNlKHJlc3VsdCwgcmVzcG9uc2UsIGNsaWVudCkpO1xuICB9XG5cbiAgX3Byb2Nlc3NDb250ZW50VXBsb2FkUmVzcG9uc2UodXBsb2FkUmVzdWx0LCBjb250ZW50UmVzcG9uc2UsIGNsaWVudCkge1xuICAgIGlmICghdXBsb2FkUmVzdWx0LnN1Y2Nlc3MpIHtcbiAgICAgIGlmICghY2xpZW50Lm9ubGluZU1hbmFnZXIuaXNPbmxpbmUpIHtcbiAgICAgICAgY2xpZW50Lm9ubGluZU1hbmFnZXIub25jZSgnY29ubmVjdGVkJywgdGhpcy5fcHJvY2Vzc0NvbnRlbnRSZXNwb25zZS5iaW5kKHRoaXMsIGNvbnRlbnRSZXNwb25zZSwgY2xpZW50KSwgdGhpcyk7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBsb2dnZXIuZXJyb3IoJ1dlIGRvblxcJ3QgeWV0IGhhbmRsZSB0aGlzIScpO1xuICAgICAgfVxuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLnRyaWdnZXIoJ3BhcnRzOnNlbmQnLCB7XG4gICAgICAgIG1pbWVfdHlwZTogdGhpcy5taW1lVHlwZSxcbiAgICAgICAgY29udGVudDoge1xuICAgICAgICAgIHNpemU6IHRoaXMuc2l6ZSxcbiAgICAgICAgICBpZDogdGhpcy5fY29udGVudC5pZCxcbiAgICAgICAgfSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBSZXR1cm5zIHRoZSB0ZXh0IGZvciBhbnkgdGV4dC9wbGFpbiBwYXJ0LlxuICAgKlxuICAgKiBSZXR1cm5zICcnIGlmIGl0cyBub3QgYSB0ZXh0L3BsYWluIHBhcnQuXG4gICAqXG4gICAqIEBtZXRob2QgZ2V0VGV4dFxuICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAqL1xuICBnZXRUZXh0KCkge1xuICAgIGlmICh0aGlzLmlzVGV4dHVhbE1pbWVUeXBlKCkpIHtcbiAgICAgIHJldHVybiB0aGlzLmJvZHk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiAnJztcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogVXBkYXRlcyB0aGUgTWVzc2FnZVBhcnQgd2l0aCBuZXcgZGF0YSBmcm9tIHRoZSBzZXJ2ZXIuXG4gICAqXG4gICAqIEN1cnJlbnRseSwgTWVzc2FnZVBhcnQgcHJvcGVydGllcyBkbyBub3QgdXBkYXRlLi4uIGhvd2V2ZXIsXG4gICAqIHRoZSBsYXllci5Db250ZW50IG9iamVjdCB0aGF0IFJpY2ggQ29udGVudCBNZXNzYWdlUGFydHMgY29udGFpblxuICAgKiBkbyBnZXQgdXBkYXRlZCB3aXRoIHJlZnJlc2hlZCBleHBpcmluZyB1cmxzLlxuICAgKlxuICAgKiBAbWV0aG9kIF9wb3B1bGF0ZUZyb21TZXJ2ZXJcbiAgICogQHBhcmFtICB7T2JqZWN0fSBwYXJ0IC0gU2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIGEgcGFydFxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgX3BvcHVsYXRlRnJvbVNlcnZlcihwYXJ0KSB7XG4gICAgaWYgKHBhcnQuY29udGVudCAmJiB0aGlzLl9jb250ZW50KSB7XG4gICAgICB0aGlzLl9jb250ZW50LmRvd25sb2FkVXJsID0gcGFydC5jb250ZW50LmRvd25sb2FkX3VybDtcbiAgICAgIHRoaXMuX2NvbnRlbnQuZXhwaXJhdGlvbiA9IG5ldyBEYXRlKHBhcnQuY29udGVudC5leHBpcmF0aW9uKTtcbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSXMgdGhlIG1pbWVUeXBlIGZvciB0aGlzIE1lc3NhZ2VQYXJ0IGRlZmluZWQgYXMgdGV4dHVhbCBjb250ZW50P1xuICAgKlxuICAgKiBJZiB0aGUgYW5zd2VyIGlzIHRydWUsIGV4cGVjdCBhIGBib2R5YCBvZiBzdHJpbmcsIGVsc2UgZXhwZWN0IGBib2R5YCBvZiBCbG9iLlxuICAgKlxuICAgKiBUbyBjaGFuZ2Ugd2hldGhlciBhIGdpdmVuIE1JTUUgVHlwZSBpcyB0cmVhdGVkIGFzIHRleHR1YWwsIHNlZSBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLlxuICAgKlxuICAgKiBAbWV0aG9kIGlzVGV4dHVhbE1pbWVUeXBlXG4gICAqIEByZXR1cm5zIHtCb29sZWFufVxuICAgKi9cbiAgaXNUZXh0dWFsTWltZVR5cGUoKSB7XG4gICAgbGV0IGkgPSAwO1xuICAgIGZvciAoaSA9IDA7IGkgPCBNZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzLmxlbmd0aDsgaSsrKSB7XG4gICAgICBjb25zdCB0ZXN0ID0gTWVzc2FnZVBhcnQuVGV4dHVhbE1pbWVUeXBlc1tpXTtcbiAgICAgIGlmICh0eXBlb2YgdGVzdCA9PT0gJ3N0cmluZycpIHtcbiAgICAgICAgaWYgKHRlc3QgPT09IHRoaXMubWltZVR5cGUpIHJldHVybiB0cnVlO1xuICAgICAgfSBlbHNlIGlmICh0ZXN0IGluc3RhbmNlb2YgUmVnRXhwKSB7XG4gICAgICAgIGlmICh0aGlzLm1pbWVUeXBlLm1hdGNoKHRlc3QpKSByZXR1cm4gdHJ1ZTtcbiAgICAgIH1cbiAgICB9XG4gICAgcmV0dXJuIGZhbHNlO1xuICB9XG5cbiAgLyoqXG4gICAqIENyZWF0ZXMgYSBNZXNzYWdlUGFydCBmcm9tIGEgc2VydmVyIHJlcHJlc2VudGF0aW9uIG9mIHRoZSBwYXJ0XG4gICAqXG4gICAqIEBtZXRob2QgX2NyZWF0ZUZyb21TZXJ2ZXJcbiAgICogQHByaXZhdGVcbiAgICogQHN0YXRpY1xuICAgKiBAcGFyYW0gIHtPYmplY3R9IHBhcnQgLSBTZXJ2ZXIgcmVwcmVzZW50YXRpb24gb2YgYSBwYXJ0XG4gICAqL1xuICBzdGF0aWMgX2NyZWF0ZUZyb21TZXJ2ZXIocGFydCkge1xuICAgIGNvbnN0IGNvbnRlbnQgPSAocGFydC5jb250ZW50KSA/IENvbnRlbnQuX2NyZWF0ZUZyb21TZXJ2ZXIocGFydC5jb250ZW50KSA6IG51bGw7XG5cbiAgICAvLyBUdXJuIGJhc2U2NCBkYXRhIGludG8gYSBCbG9iXG4gICAgaWYgKHBhcnQuZW5jb2RpbmcgPT09ICdiYXNlNjQnKSBwYXJ0LmJvZHkgPSBVdGlsLmJhc2U2NFRvQmxvYihwYXJ0LmJvZHksIHBhcnQubWltZVR5cGUpO1xuXG4gICAgLy8gQ3JlYXRlIHRoZSBNZXNzYWdlUGFydFxuICAgIHJldHVybiBuZXcgTWVzc2FnZVBhcnQoe1xuICAgICAgaWQ6IHBhcnQuaWQsXG4gICAgICBtaW1lVHlwZTogcGFydC5taW1lX3R5cGUsXG4gICAgICBib2R5OiBwYXJ0LmJvZHkgfHwgJycsXG4gICAgICBfY29udGVudDogY29udGVudCxcbiAgICAgIGhhc0NvbnRlbnQ6IEJvb2xlYW4oY29udGVudCksXG4gICAgICBzaXplOiBwYXJ0LnNpemUgfHwgMCxcbiAgICB9KTtcbiAgfVxufVxuXG4vKipcbiAqIGxheWVyLkNsaWVudCB0aGF0IHRoZSBjb252ZXJzYXRpb24gYmVsb25ncyB0by5cbiAqXG4gKiBBY3R1YWwgdmFsdWUgb2YgdGhpcyBzdHJpbmcgbWF0Y2hlcyB0aGUgYXBwSWQuXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuY2xpZW50SWQgPSAnJztcblxuLyoqXG4gKiBTZXJ2ZXIgZ2VuZXJhdGVkIGlkZW50aWZpZXIgZm9yIHRoZSBwYXJ0XG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuaWQgPSAnJztcblxuLyoqXG4gKiBBbGxvdyBsYXp5IHJlc29sdmUgbWVzc2FnZSBwYXJ0IGZpZWxkcyAoYm9keSwgc2l6ZSwgY29udGVudCwgZXRjKVxuICpcbiAqIEB0eXBlIHtmdW5jdGlvbn1cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLmxhenlSZXNvbHZlID0gbnVsbDtcblxuLyoqXG4gKiBCb2R5IG9mIHlvdXIgbWVzc2FnZSBwYXJ0LlxuICpcbiAqIFRoaXMgaXMgdGhlIGNvcmUgZGF0YSBvZiB5b3VyIHBhcnQuXG4gKlxuICogSWYgdGhpcyBpcyBgbnVsbGAgdGhlbiBtb3N0IGxpa2VseSBsYXllci5NZXNzYWdlLmhhc0NvbnRlbnQgaXMgdHJ1ZSwgYW5kIHlvdVxuICogY2FuIGVpdGhlciB1c2UgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LnVybCBwcm9wZXJ0eSBvciB0aGUgbGF5ZXIuTWVzc2FnZVBhcnQuZmV0Y2hDb250ZW50IG1ldGhvZC5cbiAqXG4gKiBAdHlwZSB7c3RyaW5nfVxuICovXG5NZXNzYWdlUGFydC5wcm90b3R5cGUuYm9keSA9IG51bGw7XG5cbi8qKlxuICogUmljaCBjb250ZW50IG9iamVjdC5cbiAqXG4gKiBUaGlzIHdpbGwgYmUgYXV0b21hdGljYWxseSBjcmVhdGVkIGZvciB5b3UgaWYgeW91ciBsYXllci5NZXNzYWdlUGFydC5ib2R5XG4gKiBpcyBsYXJnZS5cbiAqIEB0eXBlIHtsYXllci5Db250ZW50fVxuICogQHByaXZhdGVcbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLl9jb250ZW50ID0gbnVsbDtcblxuLyoqXG4gKiBUaGUgUGFydCBoYXMgcmljaCBjb250ZW50XG4gKiBAdHlwZSB7Qm9vbGVhbn1cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLmhhc0NvbnRlbnQgPSBmYWxzZTtcblxuLyoqXG4gKiBVUkwgdG8gcmljaCBjb250ZW50IG9iamVjdC5cbiAqXG4gKiBQYXJ0cyB3aXRoIHJpY2ggY29udGVudCB3aWxsIGJlIGluaXRpYWxpemVkIHdpdGggdGhpcyBwcm9wZXJ0eSBzZXQuICBCdXQgaXRzIHZhbHVlIHdpbGwgZXhwaXJlLlxuICpcbiAqIFdpbGwgY29udGFpbiBhbiBleHBpcmluZyB1cmwgYXQgaW5pdGlhbGl6YXRpb24gdGltZSBhbmQgYmUgcmVmcmVzaGVkIHdpdGggY2FsbHMgdG8gYGxheWVyLk1lc3NhZ2VQYXJ0LmZldGNoU3RyZWFtKClgLlxuICogV2lsbCBjb250YWluIGEgbm9uLWV4cGlyaW5nIHVybCB0byBhIGxvY2FsIHJlc291cmNlIGlmIGBsYXllci5NZXNzYWdlUGFydC5mZXRjaENvbnRlbnQoKWAgaXMgY2FsbGVkLlxuICpcbiAqIEB0eXBlIHtsYXllci5Db250ZW50fVxuICovXG5PYmplY3QuZGVmaW5lUHJvcGVydHkoTWVzc2FnZVBhcnQucHJvdG90eXBlLCAndXJsJywge1xuICBlbnVtZXJhYmxlOiB0cnVlLFxuICBnZXQ6IGZ1bmN0aW9uIGdldCgpIHtcbiAgICAvLyBJdHMgcG9zc2libGUgdG8gaGF2ZSBhIHVybCBhbmQgbm8gY29udGVudCBpZiBpdCBoYXMgYmVlbiBpbnN0YW50aWF0ZWQgYnV0IG5vdCB5ZXQgc2VudC5cbiAgICAvLyBJZiB0aGVyZSBpcyBhIF9fdXJsIHRoZW4gaXRzIGEgbG9jYWwgdXJsIGdlbmVyYXRlZCBmcm9tIHRoZSBib2R5IHByb3BlcnR5IGFuZCBkb2VzIG5vdCBleHBpcmUuXG4gICAgaWYgKHRoaXMuX191cmwpIHJldHVybiB0aGlzLl9fdXJsO1xuICAgIGlmICh0aGlzLl9jb250ZW50KSByZXR1cm4gdGhpcy5fY29udGVudC5pc0V4cGlyZWQoKSA/ICcnIDogdGhpcy5fY29udGVudC5kb3dubG9hZFVybDtcbiAgICByZXR1cm4gJyc7XG4gIH0sXG4gIHNldDogZnVuY3Rpb24gc2V0KGluVmFsdWUpIHtcbiAgICB0aGlzLl9fdXJsID0gaW5WYWx1ZTtcbiAgfSxcbn0pO1xuXG4vKipcbiAqIE1pbWUgVHlwZSBmb3IgdGhlIGRhdGEgcmVwcmVzZW50ZWQgYnkgdGhlIE1lc3NhZ2VQYXJ0LlxuICpcbiAqIFR5cGljYWxseSB0aGlzIGlzIHRoZSB0eXBlIGZvciB0aGUgZGF0YSBpbiBsYXllci5NZXNzYWdlUGFydC5ib2R5O1xuICogaWYgdGhlcmUgaXMgUmljaCBDb250ZW50LCB0aGVuIGl0cyB0aGUgdHlwZSBvZiBDb250ZW50IHRoYXQgbmVlZHMgdG8gYmVcbiAqIGRvd25sb2FkZWQuXG4gKlxuICogQHR5cGUge1N0cmluZ31cbiAqL1xuTWVzc2FnZVBhcnQucHJvdG90eXBlLm1pbWVUeXBlID0gJ3RleHQvcGxhaW4nO1xuXG4vKipcbiAqIFNpemUgb2YgdGhlIGxheWVyLk1lc3NhZ2VQYXJ0LmJvZHkuXG4gKlxuICogV2lsbCBiZSBzZXQgZm9yIHlvdSBpZiBub3QgcHJvdmlkZWQuXG4gKiBPbmx5IG5lZWRlZCBmb3IgdXNlIHdpdGggcmljaCBjb250ZW50LlxuICpcbiAqIEB0eXBlIHtudW1iZXJ9XG4gKi9cbk1lc3NhZ2VQYXJ0LnByb3RvdHlwZS5zaXplID0gMDtcblxuLyoqXG4gKiBBcnJheSBvZiBtaW1lIHR5cGVzIHRoYXQgc2hvdWxkIGJlIHRyZWF0ZWQgYXMgdGV4dC5cbiAqXG4gKiBUcmVhdGluZyBhIE1lc3NhZ2VQYXJ0IGFzIHRleHQgbWVhbnMgdGhhdCBldmVuIGlmIHRoZSBgYm9keWAgZ2V0cyBhIEZpbGUgb3IgQmxvYixcbiAqIGl0IHdpbGwgYmUgdHJhbnNmb3JtZWQgdG8gYSBzdHJpbmcgYmVmb3JlIGJlaW5nIGRlbGl2ZXJlZCB0byB5b3VyIGFwcC5cbiAqXG4gKiBUaGlzIHZhbHVlIGNhbiBiZSBjdXN0b21pemVkIHVzaW5nIHN0cmluZ3MgYW5kIHJlZ3VsYXIgZXhwcmVzc2lvbnM6XG4gKlxuICogYGBgXG4gKiBsYXllci5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzID0gWyd0ZXh0L3BsYWluJywgJ3RleHQvbW91bnRhaW4nLCAvXmFwcGxpY2F0aW9uXFwvanNvbihcXCsuKykkL11cbiAqIGBgYFxuICpcbiAqIEBzdGF0aWNcbiAqIEB0eXBlIHtNaXhlZFtdfVxuICovXG5NZXNzYWdlUGFydC5UZXh0dWFsTWltZVR5cGVzID0gWy9edGV4dFxcLy4rJC8sIC9eYXBwbGljYXRpb25cXC9qc29uKFxcKy4rKT8kL107XG5cbk1lc3NhZ2VQYXJ0Ll9zdXBwb3J0ZWRFdmVudHMgPSBbXG4gICdwYXJ0czpzZW5kJyxcbiAgJ2NvbnRlbnQtbG9hZGVkJyxcbiAgJ3VybC1sb2FkZWQnLFxuICAnY29udGVudC1sb2FkZWQtZXJyb3InLFxuXS5jb25jYXQoUm9vdC5fc3VwcG9ydGVkRXZlbnRzKTtcblJvb3QuaW5pdENsYXNzLmFwcGx5KE1lc3NhZ2VQYXJ0LCBbTWVzc2FnZVBhcnQsICdNZXNzYWdlUGFydCddKTtcblxubW9kdWxlLmV4cG9ydHMgPSBNZXNzYWdlUGFydDtcbiJdfQ==
