window.TimerangeSelector = function(container) {

  var  BAR_STROKE = '#3182bd',

       BAR_FILL = '#6baed6',

       MIN_UPDATE_DELAY = 800,

       MAX_BUCKETS = 46;

      /** Canvas element **/
  var element = TimerangeSelector.Template(container.width(), container.height()).appendTo(container),

      canvas = container.find('canvas'),

      canvasWidth, canvasOffset,

      /** Drawing context - initialize after appending canvas to DOM **/
      ctx,

      /** Selected interval bounds indicator **/
      selectionBounds = container.find('.trs-selection'),

      /** Interval handle elements **/
      fromHandle = container.find('.trs-handle.from'),
      fromHandleLabel = fromHandle.find('.label'),

      toHandle = container.find('.trs-handle.to'),
      toHandleLabel = toHandle.find('.label'),

      /** It's safe to assume that both handles are identical **/
      handleWidth,

      /** Labels for earliest/latest year of histogram **/
      histogramFromLabel = container.find('.trs-axislabel.from'),
      histogramZeroLabel = container.find('.trs-axislabel.zero'),
      histogramToLabel = container.find('.trs-axislabel.to'),

      /** Caches the current histogram range  **/
      histogramRange = false,

      /** Caches the selection range **/
      selectionRange = false,

      /** Conversion function: x offset to year **/
      xToYear = function(x) {
        var duration = histogramRange.to.getFullYear() - histogramRange.from.getFullYear() + 1,
            yearsPerPixel = duration / canvasWidth;

        return Math.round(histogramRange.from.getFullYear() + x * yearsPerPixel);
      },

      /** Conversion function: year to x offset **/
      yearToX = function(year) {
        var duration = histogramRange.to.getFullYear() - histogramRange.from.getFullYear() + 1,
            pixelsPerYear = canvasWidth / duration;

        return Math.round((year - histogramRange.from.getFullYear()) * pixelsPerYear);
      },

      getVal = function(obj) {
        var keys = Object.keys(obj);
        return obj[keys[0]];
      },

      getKey = function(obj) {
        return Object.keys(obj)[0];
      },

      toDate = function(str) {
        var date = new Date(str);

        // Cf. http://scholarslab.org/research-and-development/parsing-bc-dates-with-javascript/
        if (str.indexOf('-') === 0) {
          var year = (str.indexOf('-', 1) < 0) ?
            parseInt(str.substring(1)) : // -YYYY
            parseInt(str.substring(1, str.indexOf('-', 1))); // -YYYY-MM...

          date.setFullYear(-year);
        }

        return date;
      },

      /** Returns the currently selected time range **/
      getSelectedRange = function() {
        if (!selectionRange && histogramRange) {
          var xFrom = Math.max(0, selectionBounds.position().left) - canvasOffset,
              yearFrom = xToYear(xFrom),

              xTo = Math.min(xFrom + selectionBounds.outerWidth(), canvasWidth),
              yearTo = xToYear(xTo) - 1;

          if (yearFrom > yearTo)
            yearTo = yearFrom;

          if (yearFrom > histogramRange.from.getFullYear() || yearTo < histogramRange.to.getFullYear())
            selectionRange = { from: yearFrom, to: yearTo };
        }

        return selectionRange;
      },

      onDragHandle = function(e) {
        var maxX, minX,
            posX = jQuery(e.target).position().left;

        // Clear cached range
        selectionRange = false;

        if (e.target === fromHandle[0]) {
          // Left handle
          minX = handleWidth + 1;
          maxX = toHandle.position().left - handleWidth;

          if (posX < minX) {
            fromHandle.css('left', minX);
            return false;
          } else if (posX > maxX) {
            fromHandle.css('left', maxX);
            return false;
          }

          // Update handle label
          fromHandleLabel.show();
          fromHandleLabel.html(TimerangeSelector.Formatting.formatYear(xToYear(posX + handleWidth - canvasOffset)));

          // Update selection bounds
          selectionBounds.css('left', posX + handleWidth);
          selectionBounds.css('width', maxX - posX - 1);
        } else {
          // Right handle constraint check
          minX = fromHandle.position().left + handleWidth + 1;
          maxX = canvasOffset + canvasWidth + 2;

          if (posX < minX) {
            toHandle.css('left', minX + 1);
            return false;
          } else if (posX > maxX) {
            toHandle.css('left', maxX);
            return false;
          }

          // Update handle label
          toHandleLabel.show();
          toHandleLabel.html(TimerangeSelector.Formatting.formatYear(xToYear(posX - canvasOffset)));

          // Update selection bounds
          selectionBounds.css('width', posX - minX);
        }
      },

      onStopHandle = function(e) {
        onDragHandle(e);

        var selection = getSelectedRange();
        fromHandleLabel.empty();
        fromHandleLabel.hide();
        toHandleLabel.empty();
        toHandleLabel.hide();

        // if (selection) self.fireEvent('selectionChange', selection);
        // else self.fireEvent('selectionChange', { from: false, to: false });
      },

      onDragBounds = function(e) {
        var offsetX = selectionBounds.position().left - canvasOffset,
            width = selectionBounds.outerWidth(),

            fromYear = xToYear(offsetX),
            toYear = xToYear(offsetX + width);

        // Clear cached range
        selectionRange = false;

        fromHandleLabel.html(TimerangeSelector.Formatting.formatYear(fromYear));
        fromHandleLabel.show();
        fromHandle.css('left', offsetX - handleWidth + canvasOffset);

        toHandleLabel.html(TimerangeSelector.Formatting.formatYear(toYear));
        toHandleLabel.show();
        toHandle.css('left', offsetX + width + canvasOffset);

        // getSelectedRange returns a ref to the global var - don't hand this outside!
        // self.fireEvent('selectionChange', jQuery.extend({}, getSelectedRange()));
      },

      onStopBounds = function(e) {
        onDragBounds(e);

        fromHandleLabel.empty();
        fromHandleLabel.hide();

        toHandleLabel.empty();
        toHandleLabel.hide();
      },

      setSelection = function(from, to) {
        selectionRange = { from: from, to: to };

        selectionNewFromX = Math.max(0, yearToX(from));
        selectionNewToX = Math.min(yearToX(to + 1), canvasWidth);

        if (selectionNewFromX > selectionNewToX)
          selectionNewFromX = selectionNewToX;

        selectionBounds.css('left', selectionNewFromX + canvasOffset);
        fromHandle.css('left', selectionNewFromX + canvasOffset - handleWidth);

        selectionBounds.css('width', selectionNewToX - selectionNewFromX);
        toHandle.css('left', selectionNewToX + canvasOffset);
      },

      update = function(buckets) {
        if (buckets.length === 0) return;

        var toDate = function(str) {
              var date = new Date(str);

              // Cf. http://scholarslab.org/research-and-development/parsing-bc-dates-with-javascript/
              if (str.indexOf('-') === 0) {
                var year = (str.indexOf('-', 1) < 0) ?
                  parseInt(str.substring(1)) : // -YYYY
                  parseInt(str.substring(1, str.indexOf('-', 1))); // -YYYY-MM...

                date.setFullYear(-year);
              }

              return date;
            },

            currentSelection = getSelectedRange(),
            selectionNewFromX, selectionNewToX, // Updated selection bounds
            maxValue = Math.max.apply(Math, buckets.map(getVal)),
            minYear = toDate(getKey(buckets[0])),
            maxYear = toDate(getKey(buckets[buckets.length - 1])),
            height = ctx.canvas.height - 1,
            xOffset = 4,
            drawingAreaWidth = ctx.canvas.width - 2 * xOffset,
            barSpacing = Math.round(drawingAreaWidth / buckets.length),
            barWidth = barSpacing - 3;

        histogramRange = { from: minYear, to: maxYear };

        // Relabel
        histogramFromLabel.html(TimerangeSelector.Formatting.formatYear(minYear));
        histogramToLabel.html(TimerangeSelector.Formatting.formatYear(maxYear));

        if (minYear.getFullYear() < 0 && maxYear.getFullYear() > 0) {
          histogramZeroLabel.show();
          histogramZeroLabel[0].style.left = (yearToX(0) + canvasOffset - 35) + 'px';
        } else {
          histogramZeroLabel.hide();
        }

        // Redraw
        ctx.clearRect(0, 0, canvasWidth, ctx.canvas.height);

        buckets.forEach(function(obj) {
          var val = getVal(obj),
              barHeight = Math.round(Math.sqrt(val / maxValue) * height);

          ctx.strokeStyle = BAR_STROKE;
          ctx.fillStyle = BAR_FILL;
          ctx.beginPath();
          ctx.rect(xOffset + 0.5, height - barHeight + 0.5, barWidth, barHeight);
          ctx.fill();
          ctx.stroke();
          xOffset += barSpacing;
        });

        // Reset labels & selection
        // histogramRange.from = minYear;
        // histogramRange.to = maxYear;

        setSelection(currentSelection.from, currentSelection.to);

        // We don't want to handle to many updates - introduce a wait
        // ignoreUpdates = true;
        // setTimeout(function() { ignoreUpdates = false; }, MIN_UPDATE_DELAY);
      };

  fromHandleLabel.hide();
  toHandleLabel.hide();

  ctx = canvas[0].getContext('2d');
  canvasWidth = canvas.outerWidth(false);
  canvasOffset = (canvas.outerWidth(true) - canvasWidth) / 2;
  handleWidth = fromHandle.outerWidth();

  TimerangeSelector.Draggable.makeXDraggable(fromHandle, onDragHandle, onStopHandle);
  TimerangeSelector.Draggable.makeXDraggable(toHandle, onDragHandle, onStopHandle);
  TimerangeSelector.Draggable.makeXDraggable(selectionBounds, onDragBounds, onStopBounds, canvas);

  this.update = update;

};
