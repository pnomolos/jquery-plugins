/*!
 * NETEYE Touch-Gallery jQuery Plugin
 *
 * Copyright (c) 2010 NETEYE GmbH
 * Licensed under the MIT license
 *
 * Author: Felix Gnass [fgnass at neteye dot de]
 * Version: @{VERSION}
 */
(function($) {
	
	function bounds(el) {
		return el.get(0).getBoundingClientRect();
	}
	
	$.fn.touchGallery = function(getSrcCallback) {
		var thumbs = this;
		this.live('click', function(ev) {
			ev.preventDefault();
			var clickedThumb = $(this);
			if (!clickedThumb.is('.open')) {
				thumbs.addClass('open');
				showGallery(thumbs, clickedThumb, getSrcCallback || $.fn.touchGallery.defaults.getSrcCallback);
			}
		});
		$('#galleryStripe.ready:not(.panning) > .galleryPage').live('click', hideGallery);
		return this;
	};
	
	$.fn.touchGallery.defaults = {
		getSrcCallback: function() {
			return this.href;
		}
	};
	
	function showGallery(thumbs, clickedThumb, getSrcCallback) {
		clickedThumb.activity();
		var img = new Image();
		img.onload = function() {
			clickedThumb.activity(false);
			doShowGallery(thumbs, clickedThumb, getSrcCallback);
		};
		img.src = $.proxy(getSrcCallback, clickedThumb.get(0))();
	}
	
	function doShowGallery(thumbs, clickedThumb, getSrcCallback) {
		var index = thumbs.index(clickedThumb);
		
		var viewport = fitToView(preventTouch($('<div id="galleryViewport">').css({
			position: 'absolute',
			overflow: 'hidden'
		}).appendTo('body')));
		
		var stripe = $('<div id="galleryStripe">').css({
			position: 'absolute',
			whiteSpace: 'nowrap',
			height: '100%',
			top: 0,
			left: 0
		}).transform({translate: {x: -index * innerWidth}}).appendTo(viewport);
		
		insertShade(viewport);
		
		trackTouch(stripe, innerWidth, index, thumbs.length-1);
		
		$(window).bind('orientationchange.gallery', function() {
			fitToView(viewport);
			stripe.find('img').each(centerImage);
		});
		
		thumbs.each(function(i) {
			
			var page = $('<div>').addClass('galleryPage').css({
				display: 'block',
				position: 'absolute',
				left: i * innerWidth + 'px',
				overflow: 'hidden',
				height: '100%'
			}).width(innerWidth).data('thumbs', thumbs).data('thumb', $(this)).appendTo(stripe).activity(i != index);
			
			var img = new Image();
			img.onload = function() {
				
				var $img = $(this).css({position: 'absolute', display: 'block'});
				
				centerImage(i, this, $img);
				$img.transform('reset').appendTo(page.activity(false));
					
				if (i == index) {
					makeInvisible(clickedThumb);
					zoomIn(clickedThumb, $img, function() {
						makeVisible(clickedThumb);
						stripe.addClass('ready');
					});
				}
			};
			img.src = $.proxy(getSrcCallback, this)();
		});	
	}
	
	function hideGallery() {
		var page = $(this);
		$('#galleryShade').remove();
		page.data('thumbs').removeClass('open');
		var thumb = makeInvisible(page.data('thumb'));
		
		$('#galleryStripe').unbind('.pan');
		$(window).unbind('.gallery');
		
		zoomOut(page.find('img'), thumb, function() {
			makeVisible(thumb);
			$('#galleryViewport').remove();
		});
	}
	
	/**
	 * Returns the reciprocal of the current zoom-factor.
	 * @REVISIT Use screen.width / screen.availWidth instead?
	 */
	function getViewportScale() {
		return innerWidth / document.documentElement.clientWidth;
	}
	
	/**
	 * Sets position and size of the given jQuery object to match the current viewport dimensions.
	 */
	function fitToView(el) {
		return el.width(innerWidth).height(innerHeight).css({
			top: pageYOffset + 'px',
			left: pageXOffset + 'px'
		});
	}
	
	function makeVisible(el) {
		return el.css('visibility', 'visible');
	}
	
	function makeInvisible(el) {
		return el.css('visibility', 'hidden');
	}
	
	function preventTouch(el) {
		return el.bind('touchstart', function() { return false; });
	}

	/**
	 * Inserts a black DIV before the given target element and performs an opacity 
	 * transition form 0 to 1.
	 */
	function insertShade(target) {
		var l = Math.max(screen.width, screen.height) + Math.max(pageXOffset, pageYOffset);
		$('<div id="galleryShade">').css({
			position: 'absolute', top: 0, left: 0, background: '#000', opacity: 0
		})
		.width(l)
		.height(l)
		.insertBefore(target)
		.transform('reset')
		.transition({opacity: 1}, {delay: 1, duration: 1});
	}
	
	/**
	 * Scales and centers an element according to the dimensions of the given image.
	 * The first argument is ignored, it's just there so that the function can be used with .each()
	 */
	function centerImage(i, img, el) {
		el = el || $(img);
		var s = Math.min(getViewportScale(), Math.min(innerHeight/img.naturalHeight, innerWidth/img.naturalWidth));
		el.css({
			top: Math.round((innerHeight - img.naturalHeight * s) / 2) +  'px',
			left: Math.round((innerWidth - img.naturalWidth * s) / 2) +  'px'
		}).width(Math.round(img.naturalWidth * s));
	}
	
	/**
	 * Performs a zoom animation from the small to the large element. The large element is scaled 
	 * down and centered over the small element. Then a transition is performed that 
	 * resets the transformation.
	 */
	function zoomIn(small, large, onFinish) {
		var b = bounds(large);
		var t = bounds(small);
		var s = Math.max(t.width / large.width(), t.height / large.height());
		large.transform({
			translate: {
				x: t.left - b.left - Math.round((b.width * s - t.width) / 2), 
				y: t.top - b.top - Math.round((b.height * s - t.height) / 2)
			}, 
			scale: s
		})
		.transformTransition('reset', {delay: 1, onFinish: onFinish});
	}
	
	/**
	 * Performs a zoom animation from the large to the small element. Since the small version
	 * may have a different aspect ratio, the large element is wrapped inside a div and clipped
	 * to match the aspect of the small version. The wrapper div is appended to the body, as 
	 * leaving it in place causes strange z-index/flickering issues.
	 */
	function zoomOut(large, small, onFinish) {
		var b = bounds(large);
		var t = bounds(small);
		
		var w = Math.min(b.height * t.width / t.height, b.width);
		var h = Math.min(b.width * t.height / t.width, b.height);
		
		var s = Math.max(t.width / w, t.height / h);
		
		var div = $('<div>').css({
			overflow: 'hidden',
			position: 'absolute',
			width: w + 'px',
			height: h + 'px',
			top: pageYOffset + Math.round((innerHeight-h) / 2) + 'px', 
			left: pageXOffset + Math.round((innerWidth-w) / 2) + 'px'
		})
		.appendTo('body').append(large.css({
			top: 1-Math.floor((b.height-h) / 2) + 'px', // -1px offset to match Flickr's square crops
			left: -Math.floor((b.width-w) / 2) + 'px'
		}))
		.transform('reset');
		
		b = bounds(div);
		
		div.transformTransition({
			translate: {
				x: t.left - b.left - Math.round((w * s - t.width) / 2), 
				y: t.top - b.top - Math.round((h * s - t.height) / 2)
			}, 
			scale: s
		}, {onFinish: function() {
			div.remove();
			onFinish();
		}});
	}
	
	/**
	 * Registers touch-event listeners to enable panning the given element.
	 */
	function trackTouch(el, pageWidth, index, max) {
		var scale = getViewportScale();
		el.bind('touchstart.pan', function() {
			$(this).data('pan', {
				startX: event.targetTouches[0].screenX,
				lastX:event.targetTouches[0].screenX,
				startTime: new Date().getTime(),
				startOffset: $(this).transform().translate.x,
				distance: function() {
					return Math.round(scale * (this.startX - this.lastX));
				},
				delta: function() {
					var x = event.targetTouches[0].screenX;
					this.dir = this.lastX > x ? 1 : -1;
					var delta = Math.round(scale * (this.lastX - x));
					this.lastX = x;
					return delta;
				},
				duration: function() {
					return new Date().getTime() - this.startTime;
				}
			});
			return false;
		})
		.bind('touchmove.pan', function() {
			var pan = $(this).data('pan');
			$(this).transform({translateBy: {x: -pan.delta()}});
			return false;
		})
		.bind('touchend.pan', function() {
			var pan = $(this).data('pan');
			if (pan.distance() == 0 && pan.duration() < 500) {
				$(event.target).trigger('click');
			}
			else {
				index = Math.max(0, Math.min(index + pan.dir, max));
				$(this).addClass('panning').transformTransition({translate: {x: -index * pageWidth}}, {onFinish: function() { this.removeClass('panning')}});
			}
			return false;
		});
	}
	
})(jQuery);