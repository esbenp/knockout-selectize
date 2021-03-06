import $ from 'jquery'
import ko from 'knockout'
import knockoutMapping from 'knockout-mapping'
import knockoutReactor from 'knockout-reactor'
import Selectize from 'selectize'
import selectablePlaceholder from 'selectable-placeholder'
import ChangeSubscriber from 'knockout-change-subscriber'
import SubscriptionsManager from 'knockout-subscriptions-manager'

if (ko.mapping === undefined) {
    ko.mapping = knockoutMapping;
}

/**
 * Add an option group to the field
 *
 * @param selectizeInstance
 * @param optgroup
 * @param selectizeSettings
 * @param settings
 * @returns {*}
 */
var addOptgroup = function(selectizeInstance, optgroup, selectizeSettings, settings)
{
    var value = optgroup[selectizeSettings.optgroupValueField];
    var label = optgroup[selectizeSettings.optgroupLabelField];

    selectizeInstance.addOptionGroup(value, {
        "label": label,
        "$order": optgroup[settings["optgroupSort"]]
    });

    return value;
}

/**
 * Adds an option to the field, optionally with an option group
 *
 * @param selectizeInstance
 * @param option
 * @param optgroup
 */
var addOption = function(selectizeInstance, option, optgroup)
{
    if (optgroup !== undefined) {
        option.optgroup = optgroup;
    }

    selectizeInstance.addOption(option);
}

/**
 * Add multiple options to the select box
 *
 * @param selectizeInstance
 * @param options
 * @param optgroup
 */
var addOptions = function(selectizeInstance, options, optgroup)
{
    for(var i in options) {
        addOption(selectizeInstance, options[i], optgroup);
    }
}

/**
 * Is the selectize binding applied to a valid element
 *
 * @param el
 * @returns {boolean}
 */
var isElementTypeAllowed = function(el)
{
    // element is neither select nor text field
    var elementType = el.tagName.toLowerCase();
    if (elementType !== 'select' && (elementType !== "input" || el.getAttribute("type") !== "text")) {
        return false;
    }

    return true;
}

/**
 * Is the element a multiple select box
 *
 * @param el
 * @returns {*}
 */
var isMultiple = function(el)
{
    return el.prop("multiple");
}

var getObjectPropertyOrString = function getObjectPropertyOrString(objectOrString, property)
{
    if (typeof objectOrString === "object") {
        return ko.unwrap(objectOrString[property]);
    // Value is a string
    } else {
        return objectOrString;
    }
}

/**
 * Get the right value binding depending on whether
 * or not the element is a multiple box
 *
 * @param el
 * @param allBindings
 * @returns {*}
 */
var getValueObservable = function(el, allBindings)
{
    var multiple = isMultiple(el);
    if (multiple === true) {
        return allBindings.get("selectedOptions") || ko.observableArray();
    } else {
        return allBindings.get("value") || ko.observable(null);
    }
}

/**
 * Remove all options from an option group
 *
 * @param selectizeInstance
 * @param optgroup
 */
var removeOptgroupOptions = function(selectizeInstance, optgroup)
{
    var options = selectizeInstance.options;

    for(var i in options) {
        var option = options[i];
        if (option.optgroup === optgroup) {
            removeOption(selectizeInstance, option.value);
        }
    }
}

/**
 * Remove an option group from the select box
 *
 * @param selectizeInstance
 * @param optgroup
 */
var removeOptgroup = function(selectizeInstance, optgroup)
{
    selectizeInstance.removeOptionGroup(optgroup);
}

/**
 * Remove an option from the select box
 *
 * @param selectizeInstance
 * @param value
 */
var removeOption = function(selectizeInstance, value)
{
    removeValue(selectizeInstance, value);
    selectizeInstance.removeOption(value);
}

/**
 * Deselect a given value in the select box
 *
 * @param selectizeInstance
 * @param removeValue
 */
var removeValue = function(selectizeInstance, removeValue)
{
    var currentValue = selectizeInstance.getValue();

    // multiple values
    if ($.isArray(currentValue)) {
        var values = selectizeInstance.items.concat([]);

        values = $.grep(values, function(value){
            return value !== removeValue;
        });

        selectizeInstance.setValue(values);
    } else {
        if (selectizeInstance.getValue() === removeValue) {
            selectizeInstance.setValue("");
        }
    }
}

var setupDisableSubscriber = function setupDisableSubscriber(selectizeInstance, disable)
{
    if (ko.isObservable(disable)) {
        return disable.subscribe(function(newValue){
            if (newValue === true) {
                selectizeInstance.disable();
            } else {
                selectizeInstance.enable();
            }
        });
    }

    return false;
}

/**
 * Fallback for selectable placeholder. If there is a empty option
 * in the field, use its text as a selectable placeholder.
 *
 * @param el
 * @param selectizeSettings
 */
var setSelectablePlaceholderOptions = function(el, selectizeSettings)
{
    var emptyOption = el.find("option[value='']");

    // Add the selectable_placeholder plugin if it does not already exist
    if ($.inArray("selectable_placeholder", selectizeSettings.plugins) === -1) {
        selectizeSettings.plugins.push("selectable_placeholder");
    }

    // An actual empty value option is present
    if (emptyOption.length > 0) {
        selectizeSettings.placeholder = emptyOption.text();
    // If a placeholder is not sent, then set a default value.
    } else if(selectizeSettings.placeholder === undefined) {
        selectizeSettings.placeholder = "Select a value";
    }
}

var setupOptgroupSubscriber = function(selectizeInstance, options)
{

    return false;
}

/**
 * Setup a subscriber looking for changes in the options observable
 *
 * @param selectizeInstance
 * @param options
 * @param selectizeSettings
 * @param settings
 * @returns {*}
 */
var setupOptionsSubscriber = function(selectizeInstance, options, selectizeSettings, settings, subscriptionsManager)
{
    if (settings.optgrouped === true) {
        // Subscribe to optgroups
        // Foreach optgroup, subscribe to children
        subscriptionsManager.addSubscriptions(setupOptgroupSubscriber(selectizeInstance, options));

        var unwrapped = ko.unwrap(options);
        if (!(unwrapped instanceof Array)) {
            throw Error("Optgroup array is not an array.");
        }

        for(var i in unwrapped) {
            var optgroup = unwrapped[i];
            var childrensArray = optgroup[settings.optgroupValues];
            var label = optgroup[selectizeSettings.optgroupLabelField];

            subscriptionsManager.addSubscriptions(setupSingleOptionsSubscriber(selectizeInstance, childrensArray, selectizeSettings, label));
        }
    } else {
        subscriptionsManager.addSubscriptions(setupSingleOptionsSubscriber(selectizeInstance, options, selectizeSettings));
    }

    return true;
}

var setupSingleOptionsSubscriber = function(selectizeInstance, options, selectizeSettings, optgroup)
{
    if (ko.isObservable(options)) {
        return options.changeSubscriber(function(additions, deletions){
            for(var i in deletions) {
                var value = getObjectPropertyOrString(deletions[i], selectizeSettings["valueField"]);
                removeOption(selectizeInstance, value);
            }

            for(var i in additions) {
                // Cannot just do ko.mapping as this will ignore computed observables.
                var addObject = {};
                addObject[selectizeSettings.valueField] = getObjectPropertyOrString(additions[i], selectizeSettings["valueField"]);
                addObject[selectizeSettings.labelField] = getObjectPropertyOrString(additions[i], selectizeSettings["labelField"]);

                addOption(selectizeInstance, addObject, optgroup);
            }
        });
    }

    return false;
}

/**
 * Set the values of a multiple select box
 *
 * @param selectizeInstance
 * @param changes
 */
var setMultipleValues = function(selectizeInstance, changes)
{
    var values = selectizeInstance.items.concat([]);

    for(var i in changes) {
        var change = changes[i];

        if (change.status === "added") {
            if ($.inArray(change.value, values) === -1) {
                values.push(change.value);
            }
        } else if (change.status === "deleted") {
            values = $.grep(values, function(value){
                return value !== change.value;
            });
        }
    }

    selectizeInstance.setValue(values);
}

/**
 * Set the value of a single select box
 *
 * @param selectizeInstance
 * @param value
 * @returns {*}
 */
var setSingleValue = function(selectizeInstance, value)
{
    return selectizeInstance.setValue(value);
}

/**
 * Create a value subscriber for a multiple select box
 *
 * @param selectizeInstance
 * @param value
 * @returns {*}
 */
var setupMultipleValueSubscriber = function(selectizeInstance, value)
{
    if (ko.isObservable(value)) {
        return value.subscribe(function(changes){
            setMultipleValues(selectizeInstance, changes);
        }, null, "arrayChange");
    }

    return false;
}

/**
 * Create a value subscriber for a single select box
 *
 * @param selectizeInstance
 * @param value
 * @returns {*}
 */
var setupSingleValueSubscriber = function(selectizeInstance, value)
{
    if (ko.isObservable(value)) {
        return value.subscribe(function(newValue) {
            if (newValue !== selectizeInstance.getValue()) {
                setSingleValue(selectizeInstance, newValue);
            }
        });
    }

    return false;
}

/**
 * Set's the correct value subscriber depending on the type of select box
 *
 * @param selectizeInstance
 * @param value
 * @returns {*}
 */
var setupValueSubscriber = function(selectizeInstance, value, subscriptionsManager)
{
    // check if multiple
    var multiple = isMultiple(selectizeInstance.$input);

    if (multiple) {
        subscriptionsManager.addSubscription(setupMultipleValueSubscriber(selectizeInstance, value));
    } else {
        subscriptionsManager.addSubscription(setupSingleValueSubscriber(selectizeInstance, value));
    }
}

var sortOptgroups = function(optgroups, optgroupSort)
{
    var unwrapped = ko.unwrap(optgroups);
    if (optgroupSort instanceof Function) {
        unwrapped.sort(optgroupSort);
    } else {
        unwrapped.sort(function(a, b){
            var aUnwrapped = ko.unwrap(a[optgroupSort]);
            var bUnwrapped = ko.unwrap(b[optgroupSort]);

            return aUnwrapped - bUnwrapped;
        });
    }
}

/**
 * Initialize the field and setup susbscribers
 *
 * @param el
 * @param valueAccessor
 * @param allBindings
 */
var initialize = function(el, valueAccessor, allBindings) {
    if (!isElementTypeAllowed(el)) {
        throw "Element has to be a select or input text for selectize.js to work"
    }

    // Wrap element in jquery for easier management
    el = $(el);

    // Override default options with options given by the valueAccessor
    var settings = valueAccessor();
    var options = settings.options;
    var subscriptionsManager = new SubscriptionsManager();
    var selectizeSettings = allBindings.get("selectizeSettings") || {};

    // Placeholder is existing and is an observable
    if (typeof selectizeSettings.placeholder !== "undefined" && selectizeSettings.placeholder instanceof Function) {
        selectizeSettings.placeholder = ko.unwrap(selectizeSettings.placeholder);
    }

    // If selectize is a multiple, set the value to the appropriate
    // knockout.js binding
    var value = getValueObservable(el, allBindings);

    // Selectize.js bug https://github.com/brianreavis/selectize.js/issues/739
    // Still have to use selectable_placeholder
    if (allBindings.get("valueAllowUnset") === true) {
        selectizeSettings.allowEmptyOption = true;
        setSelectablePlaceholderOptions(el, selectizeSettings);
    }

    el.selectize(selectizeSettings);
    var selectizeInstance = el[0].selectize;

    subscriptionsManager.addSubscriptions(setupDisableSubscriber(selectizeInstance, allBindings.get("disable")));

    // Setup the subscribers
    setupOptionsSubscriber(selectizeInstance, options, selectizeSettings, settings, subscriptionsManager);
    if (ko.isObservable(value)) {
        setupValueSubscriber(selectizeInstance, value, subscriptionsManager);
    }

    /* If the value is given to the select box before options (i.e. options loaded async) then the select
     * behavior will by default set the value observable to undefined. Therefore we save the initial value
     * and subscribe to the options observable to know when the initial options are loaded so we can
     * reset the value observable to the original value.
     * It is important this subscription is set after the options subscription, otherwise the options will
     * not be added to selectize before the value is reset
     */
    var optionsUnwrapped = ko.unwrap(options);
    var optionsFilled = optionsUnwrapped.length > 0;
    var saveValue = settings.saveValue;

    if (optionsFilled === false) {
        subscriptionsManager.addSubscription(options.subscribe(function(){
            optionsFilled = true;
            value(saveValue);
            subscriptionsManager.dispose("optionsFilledSubscription");
        }), "optionsFilledSubscription");
    }

    // Clean up
    ko.utils.domNodeDisposal.addDisposeCallback(el[0], function() {
        // destroy the selectize.js instance
        selectizeInstance.destroy();

        // dispose of all subscriptions to prevent memory leaks
        subscriptionsManager.disposeAll();
    });
};

ko.bindingHandlers.selectize = {
    init: initialize,
    after: ["foreach"]
};

ko.bindingHandlers.option = {
    update: function(element, valueAccessor) {
        var value = ko.utils.unwrapObservable(valueAccessor());
        ko.selectExtensions.writeValue(element, value);
    }
};

ko.bindingHandlers.isOptionSelected = {
    update: function(element, valueAccessor) {
        var selectValue = ko.utils.unwrapObservable(valueAccessor());
        var optionValue = $(element).attr("value");

        if (selectValue == optionValue) {
            $(element).prop("selected", true);
        }
    }
};

ko.bindingHandlers.controlsDescendantBindings = {
    init: function() {
        return { controlsDescendantBindings: true }
    }
}

var singleMarkup = '<select>' +
  '<option data-bind=\'isOptionSelected: $parent.value, text: typeof $data === "object" ' +
                      '? $data[$parent.selectizeSettings.labelField] : $data, ' +
                      'option: typeof $data === "object" ? ' +
                      '$data[$parent.selectizeSettings.valueField] : $data\'></option>' +
'</select>';

var optgroupMarkup = '<select>' +
    '<optgroup data-bind=\'attr: {label: $data[$parent.selectizeSettings.optgroupLabelField]}, ' +
          'foreach: $data[$parent.optgroupValues]\'>' +
      '<option data-bind=\'text: $data[$parents[1].selectizeSettings.labelField], ' +
          'option: $data[$parents[1].selectizeSettings.valueField], ' +
          'isOptionSelected: $parents[1].value\'></option>' +
    '</optgroup>' +
'</select>';

ko.components.register("selectize", {
  template: '<div></div>',
  viewModel: {
    createViewModel: function(params, componentInfo) {

      var viewmodel = function(elem, params) {

        params.selectizeSettings = $.extend({
            labelField: ko.unwrap(params.optionsText) || "text",
            optgroupLabelField: "name",
            optgroupValueField: "name",
            plugins: [],
            valueField: ko.unwrap(params.optionsValue) || "value"
        }, params.selectizeSettings || {});

        if (params.selectizeSettings["searchField"] === undefined) {
            params.selectizeSettings["searchField"] = [params.selectizeSettings.labelField];
        }

        this.params = $.extend({
            disable: ko.observable(false),
            options: ko.observableArray(),
            value: params.value,
            multiple: false,
            optgrouped: false,
            optgroupLabel: params.selectizeSettings.optgroupLabelField,
            optgroupValue: params.selectizeSettings.optgroupValueField,
            optgroupValues: "children",
            optgroupSort: false,
            bindings: {}
        }, params);

        var markup;
        if (!this.params.optgrouped){
          markup = singleMarkup;
        } else {
          markup = optgroupMarkup;
        }
        markup = '<div data-bind="controlsDescendantBindings: {}">' + markup + '</div>';

        var container = $(markup);
        var select = container.find('select');

        if (select.length === 0) {
            throw "No select element was found.";
        }

        var bindingString = "";
        this.params.saveValue = ko.unwrap(params.value);

        if (params.multiple === true) {
            select[0].multiple = true;
            bindingString += "selectedOptions: value";
        } else {
            bindingString += "value: value";
        }

        if (params.emptyValue !== undefined) {
            this.params.valueAllowUnset = true;
            this.params.selectizeSettings.placeholder = params.emptyValue;
            bindingString += ", valueAllowUnset: valueAllowUnset";
        }

        if (params.optgrouped === true && params.optgroupSort !== false) {
            // Allow for optgroups to be sorted by the order parameter
            this.params.selectizeSettings.lockOptgroupOrder = true;
            // Sort at first, so that initial optgroups are sorted
            sortOptgroups(params.options, params.optgroupSort);

            // Give users an easier understanding of the settings, see issue #2
            this.params.selectizeSettings.optgroupLabelField = this.params.optgroupLabel;
            this.params.selectizeSettings.optgroupValueField = this.params.optgroupValue;
        }

        bindingString += ", foreach: options, disable: disable, " +
                            "selectize: {optgrouped: optgrouped, optgroupValues: optgroupValues, options: options, optgroupSort: optgroupSort, " +
                            "saveValue: saveValue}, selectizeSettings: selectizeSettings";

        // Transfer other non-selectize bindings to the select element
        // Copy the bindings and remove the property from the values
        var otherBindings = $.extend({}, this.params.bindings);
        this.params.bindings = undefined;

        // Add the other bindings to the binding string and
        // "inline" the values with the other parameters
        for(var i in otherBindings){
            bindingString += ", " + i + ": " + i;
            this.params[i] = otherBindings[i];
        }

        select.attr("data-bind", bindingString);

        ko.applyBindings(this.params, select[0]);

        container.appendTo($(elem).find('div'));
      }

      return new viewmodel(componentInfo.element, params);
    },
  }
});
