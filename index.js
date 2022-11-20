'use strict';

const Path = require('node:path');
const fs = require('node:fs');

let logger;

try { logger = require('loggy') } catch (error) {};

const allHeaders = new Set;

class BrunchChilidogSparser
{
	constructor(config)
	{
		this.rootConfig = config || {};
		this.config = config.plugins.chilidogsparser || {};

		this.config.include = this.config.include || false;

		this.config.exclude = this.config.exclude
			|| /app\/assets\/map\/.+\.sparse\.json$/;
	}

	compileStatic({data, path})
	{
		return this.processFile({data, path});
	}

	processFile(file)
	{
		let {data, path} = file;

		const watchedDir = this.rootConfig._normalized.paths.watched[0];
		const publicDir  = this.rootConfig._normalized.paths.public;
		const headerPath = String(path).replace(watchedDir + '/assets', publicDir).replace(/\.json$/, '.headers.json');

		const sparsedPath = String(path).replace(watchedDir + '/assets', publicDir);

		allHeaders.add('/map/' + Path.basename(headerPath));

		fs.writeFile(publicDir + '/maps.json', JSON.stringify([...allHeaders].sort(), null, 4), err => err && logger.error(err));

		try
		{
			if(fs.existsSync(sparsedPath))
			{
				const statSparsed  = fs.statSync(sparsedPath);
				const statOriginal = fs.statSync(path);
				const ageDiffMs    = statSparsed.mtimeMs - statOriginal.mtimeMs;
				const ageDiffSec   = Number(ageDiffMs / 1000).toFixed(2);

				if(statSparsed.mtimeMs > statOriginal.mtimeMs)
				{
					const existing = fs.readFileSync(sparsedPath, {encoding:'utf8', flag:'r'});

					logger.info(`Sparsed file is ${ageDiffSec} seconds newer than source, skipping: ${path}`);

					return Promise.resolve({path, data:existing});
				}

				logger.info(`Source file is ${-ageDiffSec} seconds newer than sparsed, sparsing: ${path}`);
			}
			else
			{
				logger.info(`Source file is not yet processed, sparsing: ${path}`);
			}

		}
		catch (error)
		{
			logger.error(error);
		}

		logger.info('Sparsing to: ' + sparsedPath);

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

		const sparsedData = JSON.stringify(mapData);

		const sparsedLength = sparsedData.length;

		const originalMb = (originalLength/(1024*1024)).toFixed(3);
		const sparsedMb  = (sparsedLength/(1024*1024)).toFixed(3);

		logger.info(`${path} sparsed, original ${originalMb}MB, sparsed ${sparsedMb}MB`);

		const types = new Set;

		for(const layer of mapData.layers)
		{
			if(layer.type !== 'objectgroup')
			{
				continue;
			}

			for(const object of layer.objects)
			{
				if(object.point)
				{
					continue;
				}

				types.add(object.type || object.class || object.name);
			}
		}

		mapData.types = [...types].sort();

		delete mapData.layers;

		mapData.map = '/map/' + Path.basename(path);

		const headerData = JSON.stringify(mapData, null, 4);
		const headerKb  = (headerData.length/(1024)).toFixed(3);

		logger.info(`${path} headers, original ${originalMb}MB, sparsed ${headerKb}KB`);

		fs.writeFile(headerPath, headerData, err => err && logger.error(err));

		return Promise.resolve({data:sparsedData, path});
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
