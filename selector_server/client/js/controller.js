"use strict";

// Create the main controller in the base app module.
var app = angular.module('app');

app.filter('odd', function() {
	return function(items) {
		var filtered = [];
		angular.forEach(items, function(item, index) {
			if (index % 2 == 1) {
				filtered.push(item);
			}
		});
		return filtered;
	}
});

app.filter('even', function() {
	return function(items) {
		var filtered = [];
		angular.forEach(items, function(item, index) {
			if (index % 2 == 0) {
				filtered.push(item);
			}
		});
		return filtered;
	}
});

app.controller('MainCtrl', ['$scope', 'inputReader', 'util', 'gmSelector', 'database',
														function($scope, inputReader, util, gmSelector, database) {
	$scope.inputJsonString = '';
	
	var xmin = Math.exp(-5.5);
	var xmax = Math.exp(0.5);
	var func = function(x) {
		return 1.0 / Math.pow(x, 2);
	};
	
	$scope.databases = [
		{name:'NGAdatabase', label:'NGA Database'}
	];
	
	$scope.alpha = 0.10;
	$scope.Ngms = 30;
	$scope.Nreplicates = 1;
	$scope.repeatability = true;
	
	$scope.fileLoading = false;
	$scope.fileLoaded = false;
	$scope.input = null;
	
	$scope.chartData = [];
	$scope.visibleChart = 'SA';
	$scope.outputChartData = [];
	$scope.visibleOutputChart = 'SA';
	$scope.selectionOutput = null;
	$scope.selectionOutputString = null;
	
	$scope.debug = false;
	$scope.debugOutput = null;
	
	$scope.dbLoaded = false;
	$scope.dbLoading = false;
	$scope.databaseName = '';
	$scope.databaseData = null;
	
	$scope.setSelectionDefaults = function() {
		$scope.visibleChart = 'SA';
		$scope.outputChartData = [];
		$scope.visibleOutputChart = 'SA';
		$scope.selectionOutput = null;
		$scope.selectionOutputString = null;
		$scope.Ngms = 30;
		$scope.Nreplicates = 1;
		$scope.repeatability = true;
	};
	
	$scope.$watch('alpha', function(newVal, oldVal) {
		if (newVal != oldVal && newVal > 0 && newVal <= 1) {
			$scope.updateInputCharts($scope.input);
		}
	}, true);
	
	$scope.updateInputCharts = function(input) {
		$scope.chartData = $scope.plotInputCharts(input);
		var SAChartData = $scope.plotInputSAChart(input);
		if (SAChartData) {
			$scope.chartData.splice(0,0,SAChartData);
		}
	};
	
	$scope.$watch('databaseName', function(newVal, oldVal) {
		$scope.dbLoaded = false;
		$scope.databaseData = null;
		if (newVal) {
			$scope.dbLoading = true;
			database.loadDatabase(newVal, function(data) {
				$scope.databaseData = data;
				$scope.databaseFirstLine = data[0];
				$scope.dbLoaded = true;
				$scope.dbLoading = false;
			}, function(status) {
				$scope.databaseFirstLine = status;
				$scope.dbLoading = false;
			});
		}
	}, true);
	
	$scope.selectGMs = function() {
		$scope.debugOutput = '';
		$scope.selectionOutput = gmSelector.selectGroundMotions($scope.input, $scope.databaseData,
			function(output) {
				$scope.debugOutput += output + '\n';
			}, $scope.Ngms, $scope.Nreplicates, $scope.repeatability, $scope.alpha);
		$scope.selectionOutputString = $scope.formatOutput($scope.selectionOutput);
		$scope.outputChartData = $scope.plotOutputCharts($scope.selectionOutput);
		var SAChartData = $scope.plotOutputSAChart($scope.selectionOutput, $scope.input);
		if (SAChartData) {
			$scope.outputChartData.splice(0,0,SAChartData);
		}
		var scaleFactorChartData = $scope.plotScaleFactorChart($scope.selectionOutput);
		if (scaleFactorChartData) {
			$scope.outputChartData.push(scaleFactorChartData);
		}
		var magnitudeDistanceChartData = $scope.plotMagnitudeDistanceChart($scope.selectionOutput);
		if (magnitudeDistanceChartData) {
			$scope.outputChartData.push(magnitudeDistanceChartData);
		}
	};
	
	$scope.formatOutput = function(output) {
		// Print the KS test statistic for each IM
		var outputString = 'Critical KSstat (Dcrit) is ' + output.ksCriticalValue + '.\n';
		outputString += 'KSstat values for IMs:\n'
		var biasedCount = 0;
		for (var i = 0; i < output.IMi.length; ++i) {
			var im = output.IMi[i];
			var line = '    ' + im.name + ':';
			while (line.length < 16) {
				line += ' ';
			}
			line += im.ksDiff.toFixed(6);
			if (im.ksDiff > output.ksCriticalValue) {
				line += ' (biased)';
				biasedCount++;
			}
			outputString += line + '\n';
		}
		outputString += 'The GMs selected are biased for ' + biasedCount + '/' + output.IMi.length + ' IMs considered.\n\n'
		
		// Print the selected ground motions
		outputString += 'The selected set of ground motions has a total residual of R=sum(wi*KS^2)=' + output.R.toFixed(6) + '\n\n';
		
		outputString += 'Ground motions selected and amplitude scale factors:\n'
		outputString += sprintf('%10s %-13s %14s  %11s %12s %12s %12s %12s\n', 'GM', 'DatabaseName', 'GroundMotionID', 'ScaleFactor', 'Mw', 'Rrup', 'Vs30', 'fmin');
		for (var i = 0; i < output.selectedGroundMotions.length; ++i) {
			var gm = output.selectedGroundMotions[i];
			outputString += sprintf('%10d %-13s %14d  %11.6f %12.2f %12.2f %12.2f %12.2f\n', i + 1, gm.DatabaseName, gm.GMID, gm.scaleFactor, gm.Mw, gm.Rrup, gm.Vs30, gm.freqMin);
		}
		outputString += '\n';
		
		// Print the IMi values for each ground motion
		outputString += 'Scaled IM values of selected ground motions:\n'
		var formatString = '         GM';
		var IMnames = [];
		for (var i = 0; i < output.IMi.length; ++i) {
			formatString += ' %10s';
			IMnames.push(output.IMi[i].name);
		}
		outputString += vsprintf(formatString + '\n', IMnames);
		for (var i = 0; i < output.selectedGroundMotions.length; ++i) {
			var gm = output.selectedGroundMotions[i];
			var formatString = ' %10d';
			var IMvalues = [i + 1];
			for (var j = 0; j < output.IMi.length; ++j) {
				formatString += ' %10.3f';
				IMvalues.push(gm.scaledIM[output.IMi[j].name]);
			}
			var gm = output.selectedGroundMotions[i];
			outputString += vsprintf(formatString + '\n', IMvalues);
		}
		
		return outputString;
	};
	
	var getKSbounds = function(values, ksCriticalValue) {
		// Calculate KS bounds.
		var upperKSbound = [];
		var lowerKSbound = [];
		for (var j = 0; j < values.length; ++j) {
			var x = values[j][0];
			var y_upper = values[j][1] + ksCriticalValue;
			var y_lower = values[j][1] - ksCriticalValue;
			if (y_upper <= 1) {
				upperKSbound.push([x, y_upper]);
			} else {
				var prevYUpper = values[j-1][1] + ksCriticalValue;
				if (prevYUpper <= 1) {
					var interpolatedX = util.interpolate(values[j-1][0], x, (1-prevYUpper)/(y_upper-prevYUpper));
					upperKSbound.push([interpolatedX, 1]);
				}
			}
			if (y_lower >= 0) {
				lowerKSbound.push([x, y_lower]);
			} else {
				var nextYLower = values[j+1][1] - ksCriticalValue;
				if (nextYLower >= 0) {
					var interpolatedX = util.interpolate(x, values[j+1][0], (-y_lower)/(nextYLower-y_lower));
					lowerKSbound.push([interpolatedX, 0.000001]);
				}
			}
		}
		return {
			upper: upperKSbound,
			lower: lowerKSbound
		};
	};
	
	// Generates and returns charts for the parsed input data.
	$scope.plotInputCharts = function(data) {
		var charts = [];
		for (var i = 0; i < data.numIMi; ++i) {
			var IMi = data.IMi[i];
			
			// Calculate KS bounds.
			var ksCriticalValue = util.ks_critical_value(data.numIMiRealizations, $scope.alpha);
			var ksBounds = getKSbounds(IMi.GCIMvalues, ksCriticalValue);
			
			// Iterate through CDF to find a single realization to highlight.
			var singleX = IMi.realizations[data.numIMiRealizations-1][0];
			var singleY = null;
			for (var j = IMi.realizationCDF.length-1; j >= 0; --j) {
				if (IMi.realizationCDF[j][0] == singleX) {
					singleY = IMi.realizationCDF[j][1];
					break;
				}
			}
			
			var chart = {
				name: IMi.name,
				xAxisLabel: IMi.name,
				yAxisLabel: 'Cumulative Probability, CDF',
				showYAxisScaleButtons: false,
				xScale: 'log',
				yScale: 'linear',
				legendPositionY: 'bottom',
				lines: [
					{
						'name': 'GCIM distribution',
						'isDiscrete': true,
						'data': IMi.GCIMvalues,
						'color': 'red',
						'width': '1.5px'
					},
					{
						'name': 'Realizations',
						'isDiscrete': true,
						'data': IMi.realizationCDF,
						'color': 'blue',
						'width': '1.5px'
					},
					{
						'name': 'Upper KS bound (\u03b1 = ' + $scope.alpha + ')',
						'isDiscrete': true,
						'data': ksBounds.upper,
						'color': 'red',
						'dasharray': '10,10',
						'width': '1.5px'
					},
					{
						'name': 'Lower KS bound (\u03b1 = ' + $scope.alpha + ')',
						'isDiscrete': true,
						'data': ksBounds.lower,
						'color': 'red',
						'dasharray': '10,10',
						'width': '1.5px'
					}
				],
				extraPoints: [
					// Show a single realization.
					{
						x: singleX,
						y: singleY,
						color: 'blue',
						width: '2px',
						radius: '4px'
					}
				]
			}
			charts.push(chart);
		}
		return charts;
	};
	
	// Generates a plot of Spectral Acceleration against period, T (if SA data is present).
	$scope.plotInputSAChart = function(data) {
		var chart = null;
		var realizationLines = [];
		var medianLine = [];
		var line16 = [];
		var line84 = [];
		var realizationMedianLine = [];
		var realizationLine16 = [];
		var realizationLine84 = [];
		for (var i = 0; i < data.numIMi; ++i) {
			var IMi = data.IMi[i];
			if (IMi.name.substr(0,2) == 'SA') {
				// Initialize the lines array if it's empty
				if (realizationLines.length == 0) {
					for (var j = 0; j < data.numIMiRealizations; ++j) {
						realizationLines.push([]);
					}
				}
				
				var period = IMi.period;
				var realizations = [];
				// Add points to each realization for this period
				for (var j = 0; j < data.numIMiRealizations; ++j) {
					realizationLines[j].push([period, IMi.realizations[j][0]]);
					realizations.push(IMi.realizations[j][0]);
				}
				
				// Calculate the median and 16th and 84th percentiles of the
				// realizations.
				realizations.sort(function(a,b){return a-b;});
				var median = util.median(realizations);
				var x84 = util.percentile(realizations, 84);
				var x16 = util.percentile(realizations, 16);
				realizationMedianLine.push([period, median]);
				realizationLine16.push([period, x16]);
				realizationLine84.push([period, x84]);
				
				// Calculate the median and 16th and 84th percentiles of the GCIM
				// distribution.
				var cdf = $.map(IMi.GCIMvalues, function(val, i) {
					// Swap the x and y of the CDF for interpolation.
					return [[val[1], val[0]]];
				});
				medianLine.push([period, util.interp_array(cdf, 0.5)]);
				line16.push([period, util.interp_array(cdf, 0.16)]);
				line84.push([period, util.interp_array(cdf, 0.84)]);
			}
		}
		
		// Add in the conditioning IM if it was an SA value
		if (data.IMjName.substr(0,2) == 'SA') {
			var period = data.IMjPeriod;
			var IML = data.IML;
			// Find appropriate location to insert
			var idx = 0;
			while (period > medianLine[idx][0]) {
				idx++;
			}
			// Add the conditioning value to all of the lines
			realizationMedianLine.splice(idx, 0, [period, IML]);
			realizationLine16.splice(idx, 0, [period, IML]);
			realizationLine84.splice(idx, 0, [period, IML]);
			medianLine.splice(idx, 0, [period, IML]);
			line16.splice(idx, 0, [period, IML]);
			line84.splice(idx, 0, [period, IML]);
			for (var j = 0; j < data.numIMiRealizations; ++j) {
				realizationLines[j].splice(idx, 0, [period, IML]);
			}
		}
		
		// If there were SAs in the data, build the chart.
		if (realizationLines.length > 0) {
			chart = {
				name: 'SA',
				xAxisLabel: 'Period, T (s)',
				yAxisLabel: 'Spectral acceleration, SA (g)',
				xScale: 'log',
				yScale: 'log',
				legendPositionX: 'left',
				legendPositionY: 'bottom',
				lines: []
			}
			var last = realizationLines.length - 1;
			for (var i = 0; i < realizationLines.length; ++i) {
				chart.lines.push({
					'name': 'Single Realization',
					'isDiscrete': true,
					'drawCircles': i == last,
					'data': realizationLines[i],
					'color': i == last ? 'black' : 'blue',
					'width': i == last ? '2.5px' : '0.35px',
					'showLegend': i == last
				});
			}
			
			// Add median line for realizations
			chart.lines.push({
				'name': 'Realization median',
				'isDiscrete': true,
				'data': realizationMedianLine,
				'width': '2.5px',
				'color': 'black'
			});
			
			// Add 16th percentile line for realizations
			chart.lines.push({
				'name': 'Realization 16th percentile',
				'isDiscrete': true,
				'data': realizationLine16,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'black'
			});
			
			// Add 84th percentile line for realizations
			chart.lines.push({
				'name': 'Realization 84th percentile',
				'isDiscrete': true,
				'data': realizationLine84,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'black'
			});
			
			// Add median line
			chart.lines.push({
				'name': 'GCIM median',
				'isDiscrete': true,
				'data': medianLine,
				'width': '2.5px',
				'color': 'red'
			});
			
			// Add 16th percentile line
			chart.lines.push({
				'name': 'GCIM 16th percentile',
				'isDiscrete': true,
				'data': line16,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'red'
			});
			
			// Add 84th percentile line
			chart.lines.push({
				'name': 'GCIM 84th percentile',
				'isDiscrete': true,
				'data': line84,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'red'
			});
		}
		
		return chart;
	};
	
	$scope.plotOutputCharts = function(data) {
		var charts = [];
		for (var i = 0; i < data.IMi.length; ++i) {
			var IMi = data.IMi[i];
			
			// Calculate KS bounds.
			var ksCriticalValue = util.ks_critical_value(data.selectedGroundMotions.length, $scope.alpha);
			var ksBounds = getKSbounds(IMi.GCIMvalues, ksCriticalValue);
			
			// Get selected ground motion values for this IM.
			var values = [];
			for (var j = 0; j < data.selectedGroundMotions.length; ++j) {
				var gm = data.selectedGroundMotions[j];
				values.push(gm.scaledIM[IMi.name]);
			}
			
			// Build a CDF from the values.
			var selectedCDF = util.build_cdf(values);
			
			// Get the simulated values that were used.
			var simulatedRealizations = $.map(data.simulatedRealizationsUsed, function(val, i) {
				return IMi.realizations[val][0];
			});
			
			// Build a CDF from those values.
			var simulatedCDF = util.build_cdf(simulatedRealizations);
			
			// Iterate through the two CDFs to find a single realization
			// and its corresponding selected GM to highlight.
			var singleRealizedX = simulatedRealizations[0];
			var singleRealizedY = null;
			var singleSelectedX = values[0];
			var singleSelectedY = null;
			for (var j = simulatedCDF.length-1; j >= 0; --j) {
				if (simulatedCDF[j][0] == singleRealizedX) {
					singleRealizedY = simulatedCDF[j][1];
					break;
				}
			}
			for (var j = selectedCDF.length-1; j >= 0; --j) {
				if (selectedCDF[j][0] == singleSelectedX) {
					singleSelectedY = selectedCDF[j][1];
					break;
				}
			}
			
			var chart = {
				name: IMi.name,
				xAxisLabel: IMi.name,
				yAxisLabel: 'Cumulative Probability, CDF',
				showYAxisScaleButtons: false,
				xScale: 'log',
				yScale: 'linear',
				legendPositionY: 'bottom',
				lines: [
					{
						'name': 'GCIM distribution',
						'isDiscrete': true,
						'data': IMi.GCIMvalues,
						'color': 'red',
						'width': '1.5px'
					},
					{
						'name': 'Realized GCIM values',
						'isDiscrete': true,
						'data': simulatedCDF,
						'color': 'blue',
						'width': '1.5px'
					},
					{
						'name': 'Selected GCIM values',
						'isDiscrete': true,
						'data': selectedCDF,
						'color': 'gray',
						'width': '1.5px'
					},
					{
						'name': 'Upper KS bound (\u03b1 = ' + $scope.alpha + ')',
						'isDiscrete': true,
						'data': ksBounds.upper,
						'color': 'red',
						'dasharray': '10,10',
						'width': '1.5px'
					},
					{
						'name': 'Lower KS bound (\u03b1 = ' + $scope.alpha + ')',
						'isDiscrete': true,
						'data': ksBounds.lower,
						'color': 'red',
						'dasharray': '10,10',
						'width': '1.5px'
					}
				],
				extraPoints: [
					// Show a single realization.
					{
						x: singleRealizedX,
						y: singleRealizedY,
						color: 'blue',
						width: '2px',
						radius: '4px'
					},
					// Show a single selected GM.
					{
						x: singleSelectedX,
						y: singleSelectedY,
						color: 'gray',
						width: '2px',
						radius: '4px'
					}
				]
			}
			charts.push(chart);
		}
		return charts;
	};
	
	// Generates a plot of Spectral Acceleration against period, T (if SA data is present).
	$scope.plotOutputSAChart = function(data, inputData) {
		var chart = null;
		var gmLines = [];
		var medianLine = [];
		var line16 = [];
		var line84 = [];
		var selectedGmMedianLine = [];
		var selectedGmLine16 = [];
		var selectedGmLine84 = [];
		for (var i = 0; i < data.IMi.length; ++i) {
			var IMi = data.IMi[i];
			if (IMi.name.substr(0,2) == 'SA') {
				// Initialize the lines array if it's empty
				if (gmLines.length == 0) {
					for (var j = 0; j < data.selectedGroundMotions.length; ++j) {
						gmLines.push([]);
					}
				}
				
				var period = IMi.period;
				var selectedGms = [];
				// Add points to each ground motion line for this period
				for (var j = 0; j < data.selectedGroundMotions.length; ++j) {
					var gm = data.selectedGroundMotions[j];
					gmLines[j].push([period, gm.scaledIM[IMi.name]]);
					selectedGms.push(gm.scaledIM[IMi.name]);
				}
				
				// Calculate the median and 16th and 84th percentiles of the
				// selected GMs.
				selectedGms.sort(function(a,b){return a-b;});
				var median = util.median(selectedGms);
				var x84 = util.percentile(selectedGms, 84);
				var x16 = util.percentile(selectedGms, 16);
				selectedGmMedianLine.push([period, median]);
				selectedGmLine16.push([period, x16]);
				selectedGmLine84.push([period, x84]);
				
				// Calculate the median and 16th and 84th percentiles of the GCIM
				// distribution.
				var cdf = $.map(IMi.GCIMvalues, function(val, i) {
					// Swap the x and y of the CDF for interpolation.
					return [[val[1], val[0]]];
				});
				medianLine.push([period, util.interp_array(cdf, 0.5)]);
				line16.push([period, util.interp_array(cdf, 0.16)]);
				line84.push([period, util.interp_array(cdf, 0.84)]);
			}
		}
		
		// Add in the conditioning IM if it was an SA value
		if (inputData.IMjName.substr(0,2) == 'SA') {
			var period = inputData.IMjPeriod;
			var IML = inputData.IML;
			// Find appropriate location to insert
			var idx = 0;
			while (period > medianLine[idx][0]) {
				idx++;
			}
			// Add the conditioning value to all of the lines
			medianLine.splice(idx, 0, [period, IML]);
			line16.splice(idx, 0, [period, IML]);
			line84.splice(idx, 0, [period, IML]);
			selectedGmMedianLine.splice(idx, 0, [period, IML]);
			selectedGmLine16.splice(idx, 0, [period, IML]);
			selectedGmLine84.splice(idx, 0, [period, IML]);
			for (var j = 0; j < data.selectedGroundMotions.length; ++j) {
				gmLines[j].splice(idx, 0, [period, IML]);
			}
		}
		
		// If there were SAs in the data, build the chart.
		if (gmLines.length > 0) {
			chart = {
				name: 'SA',
				xAxisLabel: 'Period, T (s)',
				yAxisLabel: 'Spectral acceleration, SA (g)',
				xScale: 'log',
				yScale: 'log',
				legendPositionX: 'left',
				legendPositionY: 'bottom',
				lines: []
			}
			var last = gmLines.length - 1;
			for (var i = 0; i < gmLines.length; ++i) {
				chart.lines.push({
					'name': 'Single Selected GM',
					'isDiscrete': true,
					'drawCircles': i == last,
					'data': gmLines[i],
					'color': i == last ? 'black' : 'gray',
					'width': i == last ? '2.5px' : '1px',
					'showLegend': i == last
				});
			}
			
			// Add median line for selected GMs
			chart.lines.push({
				'name': 'GM median',
				'isDiscrete': true,
				'data': selectedGmMedianLine,
				'width': '2.5px',
				'color': 'black'
			});
			
			// Add 16th percentile line for selected GMs
			chart.lines.push({
				'name': 'GM 16th percentile',
				'isDiscrete': true,
				'data': selectedGmLine16,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'black'
			});
			
			// Add 84th percentile line for selected GMs
			chart.lines.push({
				'name': 'GM 84th percentile',
				'isDiscrete': true,
				'data': selectedGmLine84,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'black'
			});
			
			// Add median line
			chart.lines.push({
				'name': 'GCIM median',
				'isDiscrete': true,
				'data': medianLine,
				'width': '2.5px',
				'color': 'red'
			});
			
			// Add 16th percentile line
			chart.lines.push({
				'name': 'GCIM 16th percentile',
				'isDiscrete': true,
				'data': line16,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'red'
			});
			
			// Add 84th percentile line
			chart.lines.push({
				'name': 'GCIM 84th percentile',
				'isDiscrete': true,
				'data': line84,
				'width': '2.5px',
				'dasharray': '10,10',
				'color': 'red'
			});
		}
		
		return chart;
	};
	
	$scope.plotScaleFactorChart = function(data) {
		// Get scale factors from the selected ground motions.
		var values = [];
		for (var j = 0; j < data.selectedGroundMotions.length; ++j) {
			var gm = data.selectedGroundMotions[j];
			values.push(gm.scaleFactor);
		}
		
		// Build a CDF from the values.
		var scaleFactorCDF = util.build_cdf(values);
		
		var chart = {
			name: 'Scale factors',
			xAxisLabel: 'Amplitude scale factor, SF',
			yAxisLabel: 'Cumulative Probability, CDF',
			showYAxisScaleButtons: false,
			xScale: 'log',
			yScale: 'linear',
			legendPositionY: 'bottom',
			lines: [
				{
					'name': 'Selected GM scale factors',
					'isDiscrete': true,
					'data': scaleFactorCDF,
					'color': 'red',
					'width': '1.5px'
				}
			]
		}
		return chart;
	};
	
	$scope.plotMagnitudeDistanceChart = function(data) {
		// Get magnitude and distance from the selected ground motions.
		var values = [];
		for (var j = 0; j < data.selectedGroundMotions.length; ++j) {
			var gm = data.selectedGroundMotions[j];
			values.push([gm.Rrup, gm.Mw]);
		}
		
		var chart = {
			name: 'Magnitude-distance distribution',
			xAxisLabel: 'Distance, Rrup (km)',
			yAxisLabel: 'Magnitude, Mw',
			showYAxisScaleButtons: false,
			xScale: 'log',
			yScale: 'linear',
			legendPositionY: 'bottom',
			extraPoints: $.map(values, function(val, i) {
				return {
					x: val[0],
					y: val[1],
					color: 'red',
					width: '2px'
				};
			})
		}
		return chart;
	};
	
	$scope.parseFile = function(file) {
		$scope.fileLoaded = false;
		$scope.fileLoading = true;
		if (file) {
			var r = new FileReader();
			r.onload = function(e) {
				$scope.$apply(function($scope) {
					try {
						$scope.input = inputReader.parse(e.target.result);
						$scope.updateInputCharts($scope.input);
						
						$scope.inputJsonString = JSON.stringify($scope.input, null, 2);
						$scope.fileLoaded = true;
					} catch (err) {
						alert("Error: Invalid file format.");
					} 
				});
			};
			r.readAsText(file);
		} else {
			$scope.input = null;
			$scope.chartData = [];
		}
		$scope.fileLoading = false;
		
		// Reset variables to defaults
		$scope.setSelectionDefaults();
	};
	
	// Called when the user selects a new input file.
	$scope.handleFileSelect = function(event) {
		$scope.$apply(function($scope) {
			var f = event.target.files[0];
			$scope.parseFile(f);
		});
	};
	
	$scope.handleChooserClicked = function(event) {
		$scope.$apply(function($scope) {
			$scope.fileLoaded = false;
			$scope.fileLoading = true;
		})
	};
	
	document.getElementById('inputFileSelect').addEventListener('change', $scope.handleFileSelect);
	document.getElementById('inputFileSelect').addEventListener('click', $scope.handleChooserClicked);
}]);