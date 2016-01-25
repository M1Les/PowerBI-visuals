/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ''Software''), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */

/// <reference path='../../_references.ts'/>

module powerbi.visuals.samples {
    import ClassAndSelector = jsCommon.CssConstants.ClassAndSelector;
    import createClassAndSelector = jsCommon.CssConstants.createClassAndSelector;

    export interface DifferenceAreaChartOutlineSettings {
        showOutline: boolean;
        size: number;
    }

    export interface DifferenceAreaChartColorSettings {
        highColor: string;
        lowColor: string;
    }

    export interface DifferenceAreaChartSettings {
        outline: DifferenceAreaChartOutlineSettings;
        colors: DifferenceAreaChartColorSettings;
    }

    export interface DifferenceAreaChartDataPoint extends TooltipEnabledDataPoint {
        low: number;
        high: number;
        categoryIndex: number;
        categoryValue: string;
    }

    export interface DifferenceAreaChartViewModel {
        settings: DifferenceAreaChartSettings;
        data: Array<DifferenceAreaChartDataPoint>;
        selector: data.Selector;
    }

    export interface DifferenceChartDiffLineDataPoint {
        value: number;
        color: string;
        categoryIndex: number;
    }

    module DifferenceAreaChartUtility {

        /**
         * Holds an id element selector. Will return absolute url selectors in web context.
         */
        export class IdAndSelector {
            constructor(private idValue: string) {
            }

            public get id(): string {
                return this.idValue;
            }

            public get selector(): string {
                return '#' + this.idValue;
            }

            public get urlSelector(): string {
                var absoluteUrl: string = (document && document.location && document.location.href) || '';
                return 'url(' + absoluteUrl + '#' +this.idValue + ')';
            }
        }
    }

    module DifferenceAreaChartRendering {

        /**
         * Contains all logic for adding and substracting margins to/from a chart
         */
        export class DifferenceAreaChartGeometry {

            private viewportNoMargins: IViewport = { height: 0, width: 0};

            constructor(private margin: IMargin) {
            }

            /**
             * Returns a viewport with no margins applied
             */
            public getViewportWithNoMargins(): IViewport {
                return this.viewportNoMargins;
            }

            /**
             * Returns a viewport with margins applied
             */
            public getViewport(): IViewport {
                return {
                    width: this.viewportNoMargins.width - this.margin.left - this.margin.right,
                    height: this.viewportNoMargins.height - this.margin.top - this.margin.bottom
                };
            }

            /**
             * Returns margin settings this geometry uses
             */
            public getMargin() {
                return this.margin;
            }

            /**
             * Init this instance with a viewport
             * @param newViewport Viewport
             */
            public init(newViewport: IViewport): void {
                this.viewportNoMargins = newViewport;
            }

            /**
             * Update this instance with another viewport
             * @param newViewport New viewport to use
             */
            public update(newViewport: IViewport): void {
                this.viewportNoMargins = newViewport;
            }

            /**
             * Returns whether this geometry is valid or not
             */
            public isValid(): boolean {
                var viewport = this.getViewport();
                return viewport.width > 0 && viewport.height > 0;
            }
        }
    }

    export class DifferenceAreaChart implements IVisual {

        public static visualClassName = 'differenceAreaChart';

        public static capabilities: VisualCapabilities = {
            dataRoles: [
                {
                    name: 'Category',
                    kind: VisualDataRoleKind.Grouping,
                    displayName: data.createDisplayNameGetter('Role_DisplayName_Group')
                }, {
                    name: 'Low',
                    kind: VisualDataRoleKind.Measure,
                    displayName: 'Low'
                }, {
                    name: 'High',
                    kind: VisualDataRoleKind.Measure,
                    displayName: 'High'
                }
            ],
            dataViewMappings: [{
                conditions: [
                    {
                        'Category': { max: 1 }, 'Low': { max: 1 }, 'High': { max: 1 }
                    },
                ],
                categorical: {
                    categories: {
                        for: { in: 'Category' },
                        dataReductionAlgorithm: { bottom: { count: 200 } }
                    },
                    values: {
                        group: {
                            by: 'Series',
                            select: [
                                { bind: { to: 'Low' } },
                                { bind: { to: 'High' } }
                            ]
                        },
                    }
                },
            }],
            objects: {
                outline: {
                    displayName: 'Outline',
                    properties: {
                        show: {
                            type: { bool: true },
                            displayName: data.createDisplayNameGetter('Visual_Show')
                        },
                        size: {
                            type: { numeric: true },
                            displayName: data.createDisplayNameGetter('Visual_Size')
                        }
                    }
                },
                colors: {
                    displayName: 'Colors',
                    properties: {
                        highColor: {
                            type: { fill: { solid: { color: true } } },
                            displayName: 'High color'
                        },
                        lowColor: {
                            type: { fill: { solid: { color: true } } },
                            displayName: 'Low color'
                        }
                    }
                }
            }
        };

        private static Chart: ClassAndSelector = createClassAndSelector('chart');
        private static AreaAbove: ClassAndSelector = createClassAndSelector('area-above');
        private static AreaBelow: ClassAndSelector = createClassAndSelector('area-below');
        private static OutlineHigh: ClassAndSelector = createClassAndSelector('outline-high');
        private static OutlineLow: ClassAndSelector = createClassAndSelector('outline-low');
        private static HoverLine: ClassAndSelector = createClassAndSelector('hover-line');
        private static HoverCircle: ClassAndSelector = createClassAndSelector('hover-circle');
        private static HoverCircleRadius: number = 3;

        private static Properties = {
            general: {
                formatString: <DataViewObjectPropertyIdentifier>{
                    objectName: "general",
                    propertyName: "formatString"
                }
            },
            outline: {
                show: <DataViewObjectPropertyIdentifier>{
                    objectName: 'outline',
                    propertyName: 'show'
                },
                size: <DataViewObjectPropertyIdentifier>{
                    objectName: 'outline',
                    propertyName: 'size'
                }
            },
            colors: {
                highColor: <DataViewObjectPropertyIdentifier>{
                    objectName: 'colors',
                    propertyName: 'highColor'
                },
                lowColor: <DataViewObjectPropertyIdentifier>{
                    objectName: 'colors',
                    propertyName: 'lowColor'
                }
            }
        };

        private geometry: DifferenceAreaChartRendering.DifferenceAreaChartGeometry;

        // When we need to create an element with an id we need to make sure the id
        // is unique by adding this string. Otherwise we will get same ids
        // on one report if a couple of same visuals are added to it
        private uniqueVisualId: string;

        // Main svg element
        private svg: D3.Selection;

        // Root chart group. Has all the right margins applied to it
        private chart: D3.Selection;

        // Overlay rectangular with no fill used to catch all mouse events
        private plotOverlay: D3.Selection;

        private viewModel: DifferenceAreaChartViewModel;

        // Default margins
        private margin: IMargin = { left: 45, right: 30, bottom: 10, top: 10 };

        public constructor() {
            this.uniqueVisualId = _.uniqueId();
            this.geometry = new DifferenceAreaChartRendering.DifferenceAreaChartGeometry(this.margin);
        }

        public static convertToViewModel(dataView: DataView): DifferenceAreaChartViewModel {
            if (!dataView) {
                return undefined;
            }

            if (!DifferenceAreaChart.isDataViewValid(dataView)) {
                return undefined;
            }

            var settings: DifferenceAreaChartSettings = DifferenceAreaChart.parseSettings(dataView);

            if (!settings) {
                return undefined;
            }

            var selector: data.Selector = dataView.categorical.categories[0].identity
                ? SelectionId.createWithId(dataView.categorical.categories[0].identity[0]).getSelector()
                : SelectionId.createNull().getSelector();

            var viewModel: DifferenceAreaChartViewModel = {
                data: DifferenceAreaChart.parseToDataPoints(dataView.categorical),
                settings: settings,
                selector: selector
            };

            return viewModel;
        }

        public static getDefaultColorSettings(): DifferenceAreaChartColorSettings {
            return {
                highColor: 'Green',
                lowColor: 'Red'
            };
        }

        public static getDefaultOutlineSettings(): DifferenceAreaChartOutlineSettings {
            return {
                showOutline: true,
                size: 2
            };
        }

        public static getDefaultChartSettings(): DifferenceAreaChartSettings {
            return {
                outline: DifferenceAreaChart.getDefaultOutlineSettings(),
                colors: DifferenceAreaChart.getDefaultColorSettings()
            };
        }

        private static parseSettings(dataView: DataView): DifferenceAreaChartSettings {
            var defaultSettings: DifferenceAreaChartSettings = DifferenceAreaChart.getDefaultChartSettings();

            var objects = DifferenceAreaChart.getObjectsFromDataView(dataView);

            if (objects) {
                defaultSettings.outline.showOutline = DataViewObjects.getValue<boolean>(objects, DifferenceAreaChart.Properties.outline.show, defaultSettings.outline.showOutline);
                defaultSettings.outline.size = DataViewObjects.getValue<number>(objects, DifferenceAreaChart.Properties.outline.size, defaultSettings.outline.size);

                defaultSettings.colors.highColor = DataViewObjects.getFillColor(objects, DifferenceAreaChart.Properties.colors.highColor, defaultSettings.colors.highColor);
                defaultSettings.colors.lowColor = DataViewObjects.getFillColor(objects, DifferenceAreaChart.Properties.colors.lowColor, defaultSettings.colors.lowColor);
            }

            return defaultSettings;
        }

        private static getObjectsFromDataView(dataView: DataView): DataViewObjects {
            return dataView && dataView.metadata && dataView.metadata.objects;
        }

        private static parseToDataPoints(dataViewCategorical: DataViewCategorical): Array<DifferenceAreaChartDataPoint> {
            var dataPoints: Array<DifferenceAreaChartDataPoint> = [];
            var categories = dataViewCategorical.categories && dataViewCategorical.categories.length > 0
                ? dataViewCategorical.categories[0]
                : {
                    source: undefined,
                    values: [valueFormatter.format(null)],
                    identity: undefined,
                };

            var grouped: Array<DataViewValueColumnGroup> = [];
            if (dataViewCategorical.values) {
                grouped = dataViewCategorical.values.grouped();
            }

            var lowMeasureIndex = DataRoleHelper.getMeasureIndexOfRole(grouped, 'Low');
            var highMeasureIndex = DataRoleHelper.getMeasureIndexOfRole(grouped, 'High');

            if (lowMeasureIndex >= 0 && highMeasureIndex >= 0) {
                var seriesLength = grouped.length;

                for (var seriesIndex = 0; seriesIndex < seriesLength; seriesIndex++) {
                    var grouping: DataViewValueColumnGroup = grouped[seriesIndex];
                    var seriesValues = grouping.values;

                    for (var categoryIndex = 0; categoryIndex < dataViewCategorical.categories[seriesIndex].values.length; categoryIndex++) {
                        var categoryValue = categories.values[categoryIndex];
                        var lowMeasure: DataViewValueColumn = seriesValues[lowMeasureIndex];
                        var highMeasure: DataViewValueColumn = seriesValues[highMeasureIndex];

                        var lowValue: number = lowMeasure && lowMeasure.values ? lowMeasure.values[categoryIndex] : 0;
                        var highValue: number = highMeasure && highMeasure.values ? highMeasure.values[categoryIndex] : 0;

                        var categoryColumns: Array<DataViewCategoryColumn> = [
                            dataViewCategorical.categories[0]
                        ];

                        var formatterLow = valueFormatter.create({
                            format: lowMeasure.source.format,
                            allowFormatBeautification: true,
                            columnType: lowMeasure.source && lowMeasure.source.type
                        });
                        var formatterHigh = valueFormatter.create({
                            format: highMeasure && highMeasure.source && highMeasure.source.format,
                            allowFormatBeautification: true,
                            columnType: highMeasure && highMeasure.source && highMeasure.source.type
                        });

                        var lowValueFormatted = formatterLow.format(lowValue);
                        var highValueFormatted = formatterHigh.format(highValue);

                        var seriesData: Array<TooltipSeriesDataItem> = [
                            {
                                value: lowValueFormatted,
                                metadata: lowMeasure
                            },
                            {
                                value: highValueFormatted,
                                metadata: highMeasure
                            }];

                        var tooltipInfo: Array<TooltipDataItem> =
                            TooltipBuilder.createTooltipInfo(
                                DifferenceAreaChart.Properties.general.formatString,
                                null, categoryValue,
                                null,
                                categoryColumns,
                                seriesData,
                                null);

                        var dataPoint: DifferenceAreaChartDataPoint = {
                            low: lowValue,
                            high: highValue,
                            categoryValue: categoryValue,
                            categoryIndex: categoryIndex,
                            tooltipInfo: tooltipInfo
                        };

                        dataPoints.push(dataPoint);
                    }
                }
            }

            return dataPoints;
        }

        private static isDataViewValid(dataView: DataView): boolean {
            if (dataView
                && dataView.categorical
                && dataView.categorical.categories
                && dataView.metadata
                && dataView.categorical.categories[0]
                && dataView.categorical.values) {

                return true;
            }

            return false;
        }

        /**
         * Initializes the visual by building required DOM elements
         * @param options
         */
        public init(options: VisualInitOptions): void {

            this.svg = d3.select(options.element.get(0))
                .append('svg')
                .classed(DifferenceAreaChart.visualClassName, true);

            this.chart = this.svg
                .append('g')
                .classed(DifferenceAreaChart.Chart.class, true);

            this.plotOverlay = this.svg
                .append('svg:rect')
                .attr('fill', 'none')
                .attr('pointer-events', 'all');

            this.geometry.init(options.viewport);
        }

        /**
         * Update the visual whenever there is a data or a property change
         * @param options
         */
        public update(options: VisualUpdateOptions): void {
            if (!options.dataViews && !options.dataViews[0]) {
                return;
            }

            var dataView = options.dataViews[0];

            // update chart geometry and resize the chart
            this.geometry.update(options.viewport);
            this.updateChartSize(this.geometry);

            // parse the dataview to a viewmodel and save it
            this.viewModel = DifferenceAreaChart.convertToViewModel(dataView);

            // render the chart if we were able to parse the dataview
            //otherwise -- clean up the chart
            if (this.viewModel) {
                this.render(this.viewModel, this.geometry);
            }
            else {
                this.cleanPlotArea();
            }
        }

        public destroy(): void {
            this.svg = null;
        }

        /**
         * Iterate through visual properties and set their values
         * @param options
         */
        public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): Array<VisualObjectInstance> {
            var data = this.viewModel;

            if (!data) {
                return;
            }

            switch (options.objectName) {
                case 'outline':
                    return this.enumerateOutlineOptions(data);
                case 'colors':
                    return this.enumerateColorOptions(data);
            }
        }

        private enumerateOutlineOptions(model: DifferenceAreaChartViewModel): Array<VisualObjectInstance> {
            return [{
                selector: null,
                objectName: 'outline',
                properties: {
                    show: model.settings.outline.showOutline,
                    size: model.settings.outline.size,
                }
            }];
        }

        private enumerateColorOptions(model: DifferenceAreaChartViewModel): Array<VisualObjectInstance> {
            return [{
                selector: null,
                objectName: 'colors',
                properties: {
                    lowColor: model.settings.colors.lowColor,
                    highColor: model.settings.colors.highColor,
                }
            }];
        }

        /**
         * Resize the plot
         * @param geometry
         */
        private updateChartSize(geometry: DifferenceAreaChartRendering.DifferenceAreaChartGeometry): void {
            if (geometry.isValid()) {

                var viewPort = geometry.getViewportWithNoMargins();
                var margin = geometry.getMargin();

                this.svg.attr({
                    'height': viewPort.height,
                    'width': viewPort.width
                });

                this.plotOverlay
                    .attr('width', geometry.getViewport().width)
                    .attr('height', geometry.getViewport().height)
                    .attr('transform', SVGUtil.translate(margin.left, margin.top));

                this.chart.attr('transform', SVGUtil.translate(margin.left, margin.top));
            }
        }

        /**
         * Render the chart
         * @param viewModel
         * @param geometry
         */
        private render(viewModel: DifferenceAreaChartViewModel, geometry: DifferenceAreaChartRendering.DifferenceAreaChartGeometry): void {

            if (!viewModel) {
                return;
            }

            // check if we have enough space to draw
            if (!geometry.isValid()) {
                return;
            }

            var xRange: Array<number> = [0, geometry.getViewport().width];
            var yRange: Array<number> = [geometry.getViewport().height, 0];

            var data = viewModel.data;

            // create scales

            //TODO: Add support for ordinal scale and move from naive plotting
            // by point indices to mapping to categories

            // X axis domain is just datapoint indices
            var xScale = d3.scale.linear()
                .domain([0, data.length - 1])
                .range(xRange);

            // Y axis domain is from smallest to largest data point value
            var yScale = d3.scale.linear()
                .domain([d3.min(data, d=> Math.min(d.high, d.low)), d3.max(data, d=> Math.max(d.high, d.low))])
                .range(yRange);

            // bind chart to data
            var boundChartGroup = this.chart.selectAll('g').data(data.length > 0 ? [data] : data);

            // since we need to create several elements from one data point, as a workaround
            // we create a parent group and do the drawing inside of it
            var gEnter = boundChartGroup.enter().append('g');

            //draw difference areas and outlines
            boundChartGroup.each((d, i) => {
                // remove paths from clip paths with the old data
                // because we append them on every data update
                this.chart.selectAll('clipPath > path').remove();

                var currentGroup = d3.select(boundChartGroup[0][i]);
                this.renderPlotArea((name: string, selector: string) => currentGroup.select(selector), viewModel, geometry.getViewport(), xScale, yScale);
            });

            this.renderPlotArea((name: string, selector: string) => gEnter.append(name), viewModel, geometry.getViewport(), xScale, yScale);

            boundChartGroup.exit().remove();

            // create data tooltip and hover line
            var tooltipInfoDelegate = (tooltipEvent: TooltipEvent) => {
                var xIndex = this.getXFromCoordinate(tooltipEvent.elementCoordinates[0], xScale);
                var dataPoint = this.getClosestDataPoint(xIndex, viewModel.data);

                if (dataPoint) {
                    this.drawHoverLine(dataPoint, this.viewModel.data.indexOf(dataPoint), xScale, yScale);
                    this.drawHoverLineDataPoints(this.viewModel.settings.colors, dataPoint, this.viewModel.data.indexOf(dataPoint), xScale, yScale);
                }

                return dataPoint !== undefined ? dataPoint.tooltipInfo : undefined;
            };

            var onMouseMoveOutDelegate = () => {
                this.chart.selectAll(DifferenceAreaChart.HoverLine.selector).style('opacity', SVGUtil.AlmostZero);
                this.chart.selectAll(DifferenceAreaChart.HoverCircle.selector).remove();
            };

            // bind the tooltip to overlay rectangular to catch mouse events over the whole plot area
            // not over the chart elements only
            TooltipManager.addTooltip(this.plotOverlay, tooltipInfoDelegate, true, onMouseMoveOutDelegate);
        }

        /**
         * draw hover line between high and low points
         * @param dataPoint
         * @param xScale
         * @param yScale
         */
        private drawHoverLine(dataPoint: DifferenceAreaChartDataPoint, drawAtX: number, xScale: D3.Scale.Scale, yScale: D3.Scale.Scale): void {
            var hoverLine = this.chart.selectAll('.hover-line')
                .data(dataPoint ? [dataPoint] : []);
            hoverLine.enter()
                .append('line')
                .classed(DifferenceAreaChart.HoverLine.class, true);
            hoverLine.attr({
                'x1': () =>
                    xScale(drawAtX),
                'x2': () =>
                    xScale(drawAtX),
                'y1': (d: DifferenceAreaChartDataPoint) =>
                    yScale(d.high),
                'y2': (d: DifferenceAreaChartDataPoint) =>
                    yScale(d.low)
            })
                .style('opacity', 1);
            hoverLine.exit()
                .remove();
        }

        /**
         * Draw points at the ends of hover line where it intersects
         * data lines
         * @param chartColors
         * @param dataPoint
         * @param xScale
         * @param yScale
         */
        private drawHoverLineDataPoints(chartColors: DifferenceAreaChartColorSettings, dataPoint: DifferenceAreaChartDataPoint, drawAtX: number, xScale: D3.Scale.Scale, yScale: D3.Scale.Scale): void {

            // convert data point to tw points to make the data binding easier.
            // Don't draw points if there is no data
            var points: Array<DifferenceChartDiffLineDataPoint> = [];
            if (dataPoint.high !== undefined && dataPoint.high !== null) {
                points.push({
                    categoryIndex: drawAtX,
                    color: chartColors.highColor,
                    value: dataPoint.high
                });
            }

            if (dataPoint.low !== undefined && dataPoint.low !== null) {
                points.push({
                    categoryIndex: drawAtX,
                    color: chartColors.lowColor,
                    value: dataPoint.low
                });
            }

            var dots = this.chart.selectAll(DifferenceAreaChart.HoverCircle.selector)
                .data(points);
            dots.enter().append('circle')
                .classed(DifferenceAreaChart.HoverCircle.class, true);
            dots.exit().remove();

            dots.attr('cx', (d: DifferenceChartDiffLineDataPoint) => { return xScale(d.categoryIndex); })
                .attr('cy', (d: DifferenceChartDiffLineDataPoint) => { return yScale(d.value); })
                .attr('r', DifferenceAreaChart.HoverCircleRadius)
                .attr('fill', (d: DifferenceChartDiffLineDataPoint) => { return d.color; });
        }

        /**
         * Find a data point that is closest to the given x position
         * @param xIndex x position from x axis' domain
         * @param points data point collection to search in
         */
        private getClosestDataPoint(xIndex, points: Array<DifferenceAreaChartDataPoint>): DifferenceAreaChartDataPoint {
            // since we are plotting points by their index,
            // it's safe to just round up the value to get the nearest data point
            var closestValueCatIndex = Math.round(xIndex);

            return points[closestValueCatIndex];
        }

        /**
         * Render the main plot area: areas and outlines.
         * Selector delegate is used to either append an element with given name
         * or select existing element using supplied selector.
         * Outlines are being drawn as separate lines to
         * probably add some animations in the future.
         * @param selectorDelegate gets an element by a name or a selector
         * @param viewModel
         * @param viewport
         * @param xScale
         * @param yScale
         */
        private renderPlotArea(
            selectorDelegate: (name: string, selector: string) => D3.Selection,
            viewModel: DifferenceAreaChartViewModel,
            viewport: IViewport,
            xScale: D3.Scale.LinearScale,
            yScale: D3.Scale.LinearScale): void {

            // creating above, below and in-between areas
            var areaBelowLowLine = d3.svg.area()
                //.interpolate('monotone')
                .x((d: DifferenceAreaChartDataPoint, i: number) => xScale(i))
                .y0(viewport.height)
                .y1((d: DifferenceAreaChartDataPoint) => yScale(d.low));

            var areaAboveLowLine = d3.svg.area()
                .x((d: DifferenceAreaChartDataPoint, i: number) => xScale(i))
                .y0(0)
                .y1((d: DifferenceAreaChartDataPoint) => yScale(d.low));

            var areaBetweenHighAndLow = d3.svg.area()
                .x((d: DifferenceAreaChartDataPoint, i: number) => xScale(i))
                .y0((d: DifferenceAreaChartDataPoint) => yScale(d.high))
                .y1((d: DifferenceAreaChartDataPoint) => yScale(d.low));

            // clip path to draw the below area
            var belowSelector = new DifferenceAreaChartUtility.IdAndSelector('clip-below-' + this.uniqueVisualId);
            selectorDelegate('clipPath', belowSelector.selector)
                .attr('id', belowSelector.id)
                .append('path')
                .attr('d', areaBelowLowLine);

            // clip path to draw the above area
            var aboveSelector = new DifferenceAreaChartUtility.IdAndSelector('clip-above-' + this.uniqueVisualId);
            selectorDelegate('clipPath', aboveSelector.selector)
                .attr('id', aboveSelector.id)
                .append('path')
                .attr('d', areaAboveLowLine);

            // draw the area between high and low twice specifying different clip-paths
            // to create an effect of different colors under high and under low

            // create above area (below the high line and above the low line)
            selectorDelegate('path', DifferenceAreaChart.AreaAbove.selector)
                .classed(DifferenceAreaChart.AreaAbove.class, true)
                .attr('clip-path', aboveSelector.urlSelector)
                .style('fill', viewModel.settings.colors.highColor)
                .attr('d', areaBetweenHighAndLow);

            // create below area (below the low line and above the high line)
            selectorDelegate('path', DifferenceAreaChart.AreaBelow.selector)
                .classed(DifferenceAreaChart.AreaBelow.class, true)
                .attr('clip-path', belowSelector.urlSelector)
                .style('fill', viewModel.settings.colors.lowColor)
                .attr('d', areaBetweenHighAndLow);

            // draw area outlines if necessary
            if (viewModel.settings.outline.showOutline) {
                var lowLine = d3.svg.line()
                    .x((d: DifferenceAreaChartDataPoint, i: number) => xScale(i))
                    .y((d: DifferenceAreaChartDataPoint) => yScale(d.low));

                var highLine = d3.svg.line()
                    .x((d: DifferenceAreaChartDataPoint, i: number) => xScale(i))
                    .y((d: DifferenceAreaChartDataPoint) => yScale(d.high));

                // draw the low line
                selectorDelegate('path', DifferenceAreaChart.OutlineLow.selector)
                    .classed(DifferenceAreaChart.OutlineLow.class, true)
                    .attr('d', lowLine)
                    .style('stroke-width', viewModel.settings.outline.size)
                    .style('fill', 'none')
                    .style('stroke', viewModel.settings.colors.lowColor)
                    .style('opacity', 1);

                // draw the high line
                selectorDelegate('path', DifferenceAreaChart.OutlineHigh.selector)
                    .classed(DifferenceAreaChart.OutlineHigh.class, true)
                    .attr('d', highLine)
                    .style('stroke-width', viewModel.settings.outline.size)
                    .style('fill', 'none')
                    .style('stroke', viewModel.settings.colors.highColor)
                    .style('opacity', 1);
            }
            else {

                // hide the outlines if they are switched off
                selectorDelegate('path', DifferenceAreaChart.OutlineLow.selector)
                    .style('opacity', SVGUtil.AlmostZero);

                selectorDelegate('path', DifferenceAreaChart.OutlineHigh.selector)
                    .style('opacity', SVGUtil.AlmostZero);
            }
        }

        /**
         * Convert screen x axis coordinate to a value from x scale domain
         * @param coordinateX
         * @param xScale
         */
        private getXFromCoordinate(coordinateX: number, xScale: D3.Scale.Scale): number {
            // we are using mouse coordinates that do not know about any potential CSS transform scale
            var svgNode = <SVGSVGElement>(this.chart.node());
            var ratios = SVGUtil.getTransformScaleRatios(svgNode);
            if (!Double.equalWithPrecision(ratios.x, 1.0, 0.00001)) {
                coordinateX = coordinateX / ratios.x;
            }

            return powerbi.visuals.AxisHelper.invertScale(xScale, coordinateX);
        }

        private cleanPlotArea(): void {
            this.chart.selectAll('*').remove();
        }
    }
}