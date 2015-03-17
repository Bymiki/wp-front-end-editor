( function( window, views, $ ) {
	var postID = wp.fee.postOnServer.ID || 0,
		media, gallery, av, embed;

	_.each( [
		'gallery',
		'audio',
		'video',
		'playlist',
		'embed',
		'embedURL'
	], views.unregister );

	media = {
		state: [],

		edit: function( text, update ) {
			var media = wp.media[ this.type ],
				frame = media.edit( text );

			this.pausePlayers && this.pausePlayers();

			_.each( this.state, function( state ) {
				frame.state( state ).on( 'update', function( selection ) {
					update( media.shortcode( selection ).string() );
				} );
			} );

			frame.on( 'close', function() {
				frame.detach();
			} );

			frame.open();
		}
	};

	gallery = _.extend( {}, media, {
		state: [ 'gallery-edit' ],

		initialize: function() {
			var self = this;

			wp.ajax.post( 'fee_shortcode', {
				post_ID: postID,
				shortcode: this.text
			} )
			.done( function( content ) {
				self.content = content;
				self.render();
			} );
		}
	} );

	av = _.extend( {}, media, {
		action: 'parse-media-shortcode',

		initialize: function() {
			var self = this;

			if ( this.url ) {
				this.loader = false;
				this.shortcode = wp.media.embed.shortcode( {
					url: this.text
				} );
			}

			wp.ajax.send( this.action, {
				data: {
					post_ID: postID,
					type: this.shortcode.tag,
					shortcode: this.shortcode.string()
				}
			} )
			.done( function( response ) {
				self.content = response;
				self.render();
			} )
			.fail( function( response ) {
				if ( self.url ) {
					self.removeMarkers();
				} else {
					self.setError( response.message || response.statusText, 'admin-media' );
				}
			} );

			this.getEditors( function( editor ) {
				editor.on( 'wpview-selected', function() {
					self.pausePlayers();
				} );
			} );
		},

		pausePlayers: function() {
			this.getNodes( function( editor, node, content ) {
				var win = $( 'iframe.wpview-sandbox', content ).get( 0 );

				if ( win && ( win = win.contentWindow ) && win.mejs ) {
					_.each( win.mejs.players, function( player ) {
						try {
							player.pause();
						} catch ( e ) {}
					} );
				}
			} );
		}
	} );

	embed = _.extend( {}, av, {
		action: 'parse-embed',

		edit: function( text, update ) {
			var media = wp.media.embed,
				frame = media.edit( text, this.url ),
				self = this,
				events = 'change:url change:width change:height';

			this.pausePlayers();

			frame.state( 'embed' ).props.on( events, function( model, url ) {
				if ( url && model.get( 'url' ) ) {
					frame.state( 'embed' ).metadata = model.toJSON();
				}
			} );

			frame.state( 'embed' ).on( 'select', function() {
				var data = frame.state( 'embed' ).metadata;

				if ( self.url && ! data.width ) {
					update( data.url );
				} else {
					update( media.shortcode( data ).string() );
				}
			} );

			frame.on( 'close', function() {
				frame.detach();
			} );

			frame.open();
		}
	} );

	views.register( 'gallery', _.extend( {}, gallery ) );

	views.register( 'audio', _.extend( {}, av, {
		state: [ 'audio-details' ]
	} ) );

	views.register( 'video', _.extend( {}, av, {
		state: [ 'video-details' ]
	} ) );

	views.register( 'playlist', _.extend( {}, av, {
		state: [ 'playlist-edit', 'video-playlist-edit' ]
	} ) );

	views.register( 'embed', _.extend( {}, embed ) );

	views.register( 'embedURL', _.extend( {}, embed, {
		match: function( content ) {
			var re = /(^|<p>)(https?:\/\/[^\s"]+?)(<\/p>\s*|$)/gi,
				match = re.exec( content );

			if ( match ) {
				return {
					index: match.index + match[1].length,
					content: match[2],
					options: {
						url: true
					}
				};
			}
		}
	} ) );
} )( window, window.wp.mce.views, window.jQuery );
