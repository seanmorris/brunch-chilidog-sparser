'use strict';

let logger;

try { logger = require('loggy') } catch (error) {};

class BrunchChilidogSparser
{
	constructor(config)
	{
		this.config		 = config.plugins.chilidogsparser || {};

		this.config.include = this.config.include || false;

		this.config.exclude = this.config.exclude
			|| /app\/assets\/map\/.+\.sparse\.json$/;
	}

	compileStatic({data, path})
	{
		return this.processFile({data, path});
	}

	processFile({data, path})
	{
		if(this.config.exclude && path.match(this.config.exclude))
		{
			if(this.config.include && !path.match(this.config.include))
			{
				return null;
			}

			if(!this.config.include)
			{
				return null;
			}
		}

		const originalLength = data.length;

		logger.info('Sparsing ' + path);

		const mapData = JSON.parse(data);

		if(!mapData.layers)
		{
			return Promise.resolve({data, path});
		}

		for(const layer of mapData.layers)
		{
			if(layer.type !== 'tilelayer' || !layer.data)
			{
				continue;
			}

			const sparsed = [];

			for(const tileId in layer.data)
			{
				const tileNumber = layer.data[tileId];

				if(!tileNumber)
				{
					continue;
				}

				sparsed.push(Number(tileId), Number(tileNumber));
			}

			layer.sparsed = sparsed;

			delete layer.data;
		}

		data = JSON.stringify(mapData);

		const sparsedLength = data.length;

		const originalMb = (originalLength/(1024*1024)).toFixed(3);
		const sparsedMb  = (sparsedLength/(1024*1024)).toFixed(3);

		logger.info(`${path} sparsed, original ${originalMb}MB, sparsed ${sparsedMb}MB`);

		return Promise.resolve({data, path});
	}
}

const brunchPlugin = true;
const pattern	   = /app\/assets\/map\/.*\.json$/;
const type	 	   = 'template';

const staticTargetExtension = 'json';
const extension    = 'json';

Object.assign(BrunchChilidogSparser.prototype, {
	brunchPlugin
	, pattern
	, type
	, staticTargetExtension
	, extension
});

module.exports = BrunchChilidogSparser;
