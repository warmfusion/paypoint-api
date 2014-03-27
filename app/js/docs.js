/**
 * An aggregate object to be used globally
 * @constructor
 */
var Documentation = function () {
	var self = this;

	self.templateLoader = new TemplateLoader();
	self.definitionLoader = new DefinitionLoader();

	var updateMenu = function(){
		var hash = location.hash.replace(/^#/, '');
		new PageRenderer($('#page')).render(hash);
		var menu = $('#pp-menu');
		menu.find('li').removeClass('active');
		var menuitem = menu.find('a[href="#' + hash + '"]').parent();

		$('*').removeClass('pp-nav-selected');
		$('.pp-nav-group').addClass('pp-nav-collapsed');

		if ((menuitem).hasClass('pp-nav-group')) { // expand the group
			menuitem.addClass('active');
			menuitem.addClass('pp-nav-selected');
			menuitem.removeClass('pp-nav-collapsed');
			var parents = menuitem.parents('.pp-nav-group');
			parents.removeClass('pp-nav-collapsed');
		} else { // expand all the parent groups
			var parents = menuitem.parents('.pp-nav-group');
			parents.addClass('active');
			parents.removeClass('pp-nav-collapsed');
			menuitem.addClass('pp-nav-selected');
		}

		// update print link for the newly rendered page
		$('#page-print').attr('href', 'index-print.html' + location.hash);
		// scroll content to top
		$('.content').scrollTop(0);
	}

	// listen to hash change events and render pages based on the hash
	$(window).on('hashchange', updateMenu);

	// listen to refresh and do the same as hashchange to ensure consistent experience
	$(window).on('load', updateMenu);

	/**
	 * retrieves an example object from the server and caches the result
	 * @type {*}
	 */
	self.getExample = _.memoize(function (example) {
		var content = {};
		$.ajax({
			'async': false,
			'global': false,
			'url': 'app/definitions/examples/' + example + '.json',
			'dataType': 'json',
			'success': function (data) {
				content = data;
			}
		});
		return content;
	});

	/**
	 * retrieves a page template from the server, computes and returns the template function while caching the result
	 * @type {*}
	 */
	self.getPageTemplateFn = _.memoize(function (page) {
		var content = '';
		$.ajax({
			'async': false,
			'global': false,
			'url': 'app/templates/pages/' + page + '.html',
			'dataType': 'html',
			'success': function (data) {
				content = data;
			}
		});
		return _.template(content);
	});
};

/**
 * TemplateLoader object; it loads specific templates from the server and caches them internally.
 * ... the loading of templates occurs when the object is constructed and the calls are synchronous!
 * @constructor
 */
var TemplateLoader = function () {
	var self = this;

	// template location constants
	var locations = {
		'documentation': 'app/templates/layout/documentation.html',
		'header': 'app/templates/layout/header.html',
		'footer': 'app/templates/layout/footer.html',
		'menu': 'app/templates/layout/menu.html',
		'menu-items': 'app/templates/layout/menu-items.html',
		'page': 'app/templates/layout/page.html',
		'endpoint': 'app/templates/layout/endpoint.html',
		'type': 'app/templates/layout/type.html',
		'type-items': 'app/templates/layout/type-items.html',
		'type-items-field-col': 'app/templates/layout/type-items-field-col.html',
		'type-items-field-close-col': 'app/templates/layout/type-items-field-close-col.html',
		'type-items-desc-col': 'app/templates/layout/type-items-desc-col.html',
		'example': 'app/templates/layout/example.html'
	};

	// stores string and compiled templates
	var templates = {};

	// load templates synchronously
	_.each(locations, function (value, key) {
		$.ajax({
			'async': false,
			'global': false,
			'url': value,
			'dataType': 'html',
			'success': function (data) {
				templates[key] = {
					string: data,
					fn: _.template(data)
				};
			}
		});
	});

	// returns the template {string,fn} for the specified name or the entire map of templates <name|{string,fn}>
	self.get = function (name) {
		if (name) {
			return templates[name];
		}
		return templates;
	};
};

/**
 * DefinitionLoader object; it loads model definitions from the server and caches them internally.
 * ... the loading of definitions occurs when the object is constructed and the call are synchronous!
 * @constructor
 */
var DefinitionLoader = function () {
	var self = this;

	// model definition files
	var locations = {
		menu: 'app/definitions/menu.json',
		swagger: 'app/definitions/swagger.json',
		mutations: 'app/definitions/mutations.json'
	};

	// model definition object
	var definitions = {};

	// load model definition files
	_.each(locations, function (value, key) {
		$.ajax({
			'async': false,
			'global': false,
			'url': value,
			'dataType': 'json',
			'success': function (data) {
				definitions[key] = data;
			}
		});
	});

	// returns the definition for the specified name {object} or the entire definition map {<name|object>}
	self.get = function (name) {
		if (name) {
			return definitions[name];
		}
		return definitions;
	};
};

/**
 * generic template renderer; it can optionally receive a container object for which it will automatically replace
 * the rendered result during the render function invocation
 *
 * @param container
 * @constructor
 */
var GenericRenderer = function (container) {
	var self = this;

	// renders the template - model pair; if the object is constructed with a target container, this function will
	// automatically replace the html of the container element with the result of the computation
	self.render = function (template, model) {
		var htmlResult = PPDoc.templateLoader.get(template).fn(model || {});
		if (container) {
			container.html(htmlResult);
		}
		return htmlResult;
	}
};

/**
 * specific page renderer; it can optionally receive a container object for which it will automatically replace
 * the rendered result during the render function invocation
 *
 * @param container
 * @constructor
 */
var PageRenderer = function (container) {
	var self = this;

	// renders the template page; if the object is constructed with a target container, this function will
	// automatically replace the html of the container element with the result of the computation
	self.render = function (page) {
		var html = PPDoc.getPageTemplateFn(page)({});
		if (container) {
			container.html(html);
		}
		return html;
	};
};

/**
 * specific example renderer; it can optionally receive a container object for which it will automatically replace
 * the rendered result during the render function invocation
 *
 * @param container
 * @constructor
 */
var ExampleRenderer = function (container) {
	var self = this;

	// maps a JS object to its json string representation while also adding styling spans for supported json types
	var prepare = function (object) {
		if (!object) {
			return '';
		}

		var json = object;
		if (typeof json != 'string') {
			json = JSON.stringify(json, undefined, 2);
		}
		json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
		return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
			var cls = 'json-number';
			if (/^"/.test(match)) {
				if (/:$/.test(match)) {
					cls = 'json-key';
				} else {
					cls = 'json-string';
				}
			} else if (/true|false/.test(match)) {
				cls = 'json-boolean';
			} else if (/null/.test(match)) {
				cls = 'json-null';
			}
			return '<span class="' + cls + '">' + match + '</span>';
		});
	};

	// maps an example object to an object ready to be used by the example template render function
	var map = function (object) {
		return {
			description: object.description,
			request: {
				description: object.request.description,
				body: prepare(object.request.body)
			},
			response: {
				description: object.response.description,
				body: prepare(object.response.body)
			}
		}
	};

	// renders the template example; if the object is constructed with a target container, this function will
	// automatically replace the html of the container element with the result of the computation
	self.render = function (example) {
		var object = PPDoc.getExample(example);
		var html = new GenericRenderer().render('example', map(object));
		if (container) {
			container.html(html);
		}
		return html;
	};
};

/**
 * specific print renderer that is used by the index-print entry html file to render either a page or the entire
 * documentation; it can optionally receive a container object for which it will automatically replace
 * the rendered result during the render function invocation
 *
 * @param container
 * @constructor
 */
var PrintRenderer = function (container) {
	var self = this;

	// lookup the page template function
	var templateFn = PPDoc.templateLoader.get('page');

	// optionally renders the specified page in the container object used while constructing the renderer and returns
	// the html result
	var renderPage = function (page) {
		return new PageRenderer(container).render(page);
	};

	// optionally renders the entire documentation (all pages) in the order that the pages are defined in the menu definition
	// within the container object specified when constructing the renderer and returns the resulting html string
	var renderAll = function () {
		var pages = _.map(_.crush(PPDoc.definitionLoader.get('menu')), function (item) {
			return item.replace(/^#/, '')
		});
		var rendered = _.map(pages, function (page) {
			return new PageRenderer().render(page);
		});
		var glued = _.reduce(rendered, function (memo, item) {
			return memo + item
		}, '');
		if (container) {
			container.html(glued);
		}
		return glued;
	};

	// print renderer main logic function; depending on whether the page is loaded with a page hash it renders the
	// specified page or the entire documentation and returns the resulting html string; if the renderer is
	// constructed using a target container this function will automatically replace the container inner html with
	// the resulting html of the computation
	self.render = function () {
		var hash = location.hash.replace(/^#/, '');
		if (hash === '') {
			return renderAll();
		} else {
			return new PageRenderer(container).render(hash);
		}
	};
};

/**
 * model provider object for endpoint templates; it is constructed using the target endpoint address for which
 * it computes the required model to render the endpoint template
 *
 * @param address
 * @param context
 * @constructor
 */
var EndpointModelProvider = function (address, context) {
	var self = this;

	// endpoint description computation
	var description = _.map(
		_.filter(PPDoc.definitionLoader.get('swagger').apis, function (item) {
			return item.path === address
		}),
		function (item) {
			return item.operations[0];
		}
	)[0];

	// url parameters computation
	var urlParameters = _.filter(description.parameters, function (item) {
		return item.paramType !== 'body';
	});

	// request body computation
	var requestBody = _.filter(description.parameters, function (item) {
		return item.paramType === 'body';
	})[0];

	// request body dataType
	var dataType = _.isObject(requestBody) ? requestBody.dataType : null;

	// returns the model object required for endpoint template execution
	self.get = function () {
		return {
			model: {
				header: 'API Endpoint',
				endpoint: address,
				method: description.httpMethod,
				summary: description.summary,
				parameters: urlParameters,
				request: dataType,
				response: description.responseClass,
				context: context
			}
		}
	};
};

/**
 *
 * @param context
 * @param type
 * @param typeReference
 * @param field
 * @param parent
 * @param displayFlags
 * @constructor
 */
var TypeModelProvider = function (context, type, typeReference, field, parent, displayFlags) {
	var self = this;

	var definitions = PPDoc.definitionLoader.get('swagger');

	var path = parent ? parent.path() + '/' + field : '';

	var mutationHandler = new TypeMutationHandler(type, field, context, path);

	var showFlags = _.isUndefined(displayFlags) ? !mutationHandler.hideFlags() : displayFlags;

	self.path = function () {
		return path;
	};

	self.offset = function () {
		var offset = 0;
		var lookup = self.parent();
		while (!_.isUndefined(lookup)) {
			offset++;
			lookup = lookup.parent();
		}
		return offset;
	};

	self.get = function () {
		return {
			mutations: mutationHandler,
			provider: self
		};
	};

	self.parent = function () {
		return parent;
	};

	self.rootReference = function () {
		return definitions.models[type];
	};

	self.isTypeDefined = function () {
		return !_.isUndefined(self.rootReference());
	};

	self.hideTypeDescription = function () {
		return self.isTypeDefined() && !self.hasValues();
	};

	var isPrimitive = function (type) {
		return _.isUndefined(definitions.models[type]);
	};

	self.childTypes = function () {
		if (!self.isTypeDefined()) {
			return [];
		}
		if (_.isEmpty(self.rootReference().properties)) {
			return [];
		}
		return _.map(self.rootReference().properties, function (value, key) {
			return new TypeReference(key, value);
		});
	};

	self.hasChildTypes = function () {
		return !_.isEmpty(self.childTypes());
	};

	self.isArray = function () {
		return type === 'List';
	};

	self.arrayType = function () {
		var field = isPrimitive(typeReference.itemType()) ? 'item' : '';
		return new TypeReference(field, {type: typeReference.itemType()});
	};

	self.hasChildren = function () {
		return self.hasChildTypes();
	};

	self.allowedValues = function () {
		if (!self.isTypeDefined()) {
			return [];
		}
		if (_.isUndefined(self.rootReference().values)) {
			return [];
		}
		return _.map(self.rootReference().values, function (value, key) {
			return key;
		});
	};

	self.hasValues = function () {
		return !_.isEmpty(self.allowedValues());
	};

	self.valueString = function () {
		var glueFn = function (glue) {
			return function (element, elementToGlue) {
				return element + (element.length ? glue : '') + elementToGlue;
			}
		};
		return _.reduce(self.allowedValues(), glueFn(', '), '');
	};

	self.providerFor = function (child) {
		return new TypeModelProvider(context, child.type(), child, child.field(), self, showFlags);
	};

	self.fieldName = function () {
		return typeReference ? typeReference.field() : '';
	};

	self.typeName = function () {
		return self.hasValues() ? 'string' : mutationHandler.alias();
	};

	self.description = function () {
		var prefix = mutationHandler.prefixDescription();
		var prefixString = _.isUndefined(prefix) ? '' : prefix;

		var suffix = mutationHandler.suffixDescription();
		var suffixString = _.isUndefined(suffix) ? '' : suffix;

		var override = mutationHandler.overrideDescription();
		var overrideString = _.isUndefined(override) ? '' : override;

		var referenceDescription = typeReference ? typeReference.description() : undefined;
		var rootReferenceDescription = self.rootReference() ? self.rootReference().description : undefined;
		var referenceString = referenceDescription || rootReferenceDescription || '';

		var description = _.isUndefined(override) ? referenceString : overrideString;

		return prefixString + ' ' + description + ' ' + suffixString;
	};

	self.hide = function () {
		var visibility =  mutationHandler.isVisibleByDefault();

		if (!_.isUndefined(typeReference)) {
			visibility = typeReference.display(visibility);
		}

		visibility =  visibility || mutationHandler.show();

		visibility =  visibility && !mutationHandler.hide();

		return !visibility;
	};

	self.hideField = function () {
		return mutationHandler.hideField();
	};

	self.flags = function () {
		if (!showFlags) {
			return [];
		}
		var referenceFlags = typeReference ? typeReference.flags() : undefined;
		var rootReferenceFlags = self.rootReference() ? self.rootReference().flags : undefined;
		var flags = referenceFlags || rootReferenceFlags || [];
		var filtered = _.filter(flags, function (flag) {
			return !_.contains(flagsToFilter, flag);
		});

		return _.map(filtered, function (value) {
			return {
				text: value,
				title: flagDefinitions[value].title,
				className: flagDefinitions[value].className
			};
		});
	};

	// constant flag definition object; it maps a flag symbol to the flag description an class used to render the flag
	var flagDefinitions = {
		M: {
			title: 'Mandatory',
			className: 'data-type-mandatory'
		},
		C: {
			title: 'Choice',
			className: 'data-type-choice'
		},
		O: {
			title: 'Optional',
			className: 'data-type-optional'
		}
	};

	// flag filter definition
	var flagsToFilter = ['O', 'C'];
};

/**
 * mutation handler to be used by the type model provider; it reads presentation mutations that fields and types
 * suffer depending on the context of the template rendering operation
 *
 * @param type
 * @param field
 * @param context
 * @param path
 * @constructor
 */
var TypeMutationHandler = function (type, field, context, path) {
	var self = this;

	// global model definitions
	var definitions = PPDoc.definitionLoader.get('swagger');
	// global mutation definitions
	var mutations = PPDoc.definitionLoader.get('mutations');

	// root type reference
	var mapped = definitions.models[type];

	// path mutations for the current path
	var pathMutations = mutations.paths[path] || [];

	// type mutations for the current type
	var typeMutations = mutations.types[type];

	// retrieves a mutation definitions for the current path and argument mutation type
	var pathMutationOf = function (mutation) {
		return _.find(pathMutations, function (item) {
			return item.mutation === mutation && (_.isUndefined(item.context) || item.context === context);
		});
	};

	// retrieves a mutation definition for the current type and argument mutation type
	var typeMutationOf = function (mutation) {
		return _.find(typeMutations, function (item) {
			return item.mutation === mutation && (_.isUndefined(item.context) || item.context === context);
		});
	};

	// returns whether the current type has a root type reference
	self.isDefined = function () {
		return !_.isUndefined(mapped);
	};

	// returns the default visibility for the current type
	self.isVisibleByDefault = function () {
		var pathMutation = _.isUndefined(pathMutationOf('default-hide'));
		var typeMutation = _.isUndefined(typeMutationOf('default-hide'));
		return pathMutation && typeMutation;
	};

	// returns whether the field entry should be shown, based on path and type mutations
	self.show = function () {
		var pathMutation = !_.isUndefined(pathMutationOf('context-show'));
		var typeMutationEntry = typeMutationOf('context-show');
		var typeMutation = !_.isUndefined(typeMutationEntry);
		return pathMutation || typeMutation;
	};

	self.hide = function () {
		var pathMutation = !_.isUndefined(pathMutationOf('context-hide'));
		var typeMutationEntry = typeMutationOf('context-hide');
		var typeMutation = !_.isUndefined(typeMutationEntry);
		return pathMutation || typeMutation;
	};

	// returns whether the field name should be hidden, based on current field
	self.hideField = function () {
		return _.isEmpty(field);
	};

	// returns the alias value or the type name
	self.alias = function () {
		var mutation = typeMutationOf('alias');
		return _.isUndefined(mutation) ? type : mutation.alias;
	};

	// returns the prefix description for this type or undefined
	self.prefixDescription = function () {
		var mutation = typeMutationOf('prefix-description');
		return _.isUndefined(mutation) ? undefined : mutation.description;
	};

	// returns the suffix description for this type or undefined
	self.suffixDescription = function () {
		var mutation = typeMutationOf('suffix-description');
		return _.isUndefined(mutation) ? undefined : mutation.description;
	};

	// returns the overridden description for this type or undefined
	self.overrideDescription = function () {
		var mutation = pathMutationOf('override-description');
		return _.isUndefined(mutation) ? undefined : mutation.description;
	};

	// returns whether flags should be hidden for this type or not
	self.hideFlags = function () {
		var mutation = typeMutationOf('hide-flags');
		return !_.isUndefined(mutation);
	};
};

/**
 *
 * @param childKey
 * @param childValue
 * @constructor
 */
var TypeReference = function (childKey, childValue) {
	var self = this;

	self.field = function () {
		return childKey;
	};

	self.type = function () {
		return childValue.type;
	};

	self.itemType = function () {
		return childValue.items;
	};

	self.description = function () {
		return childValue.description;
	};

	self.flags = function () {
		return childValue.flags;
	};

	self.display = function (defaultValue) {
		return _.read(childValue, 'display', defaultValue);
	};
};

/**
 * flattens objects and / or arrays
 */
_.mixin({crush: function(l, s, r) {return _.isObject(l)? (r = function(l) {return _.isObject(l)? _.flatten(_.map(l, s? _.identity:r)):l;})(l):[];}});

/**
 * safely traverses the object using the specified property chain; if the chain is incomplete it will return the
 * specified default value; if an entry in the chain is a function, the traversal will continue by calling that function
 * with no arguments
 */
_.mixin({
	read: function(object, chain, defaultValue) {
		if(_.isUndefined(object)) {
			return defaultValue;
		}
		if(_.isString(chain)) {
			return _.has(object, chain) ? object[chain] : defaultValue;
		}
		return _.reduce(chain, function (memo, item) {
			var next = memo[item];
			if (_.isUndefined(next)) {
				return defaultValue;
			}
			if (_.isFunction(next)) {
				return next.apply();
			}
			return next;
		}, object);
	}
});

