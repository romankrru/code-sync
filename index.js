const {promisify} = require('util');
const path = require('path');
const {readFileSync} = require('fs');
const exec = promisify(require('child_process').exec);
const writeFile = promisify(require('fs').writeFile);
const copyFile = promisify(require('fs').copyFile);
const homedir = require('os').homedir();

/* HELPERS */

const diff = (base, values) =>
	values.reduce((acc, value) => {
		if (base.includes(value)) return acc;

		acc.push(value);
		return acc;
	}, []);

const getPathToConfig = () => {
	const common = ['Code', 'User'];

	if (process.platform === 'win32')
		return path.join(homedir, 'AppData', 'Roaming', ...common);

	return path.join(homedir, '.config', ...common);
};

const readInstalledExtensions = () =>
	exec('code --list-extensions')
		.then(({stdout, stderr}) => {
			if (stderr) {
				console.log(`Unable to get extensions. stderr: ${stderr}`);
				process.exit(1);
			}

			return stdout;
		})

		.catch(console.error);

const transformExtensionsStringToArray = extensionsString =>
	extensionsString.split('\n').filter(Boolean); // exclude empty strings

const installExtension = extension => {
	console.log(`📦 Installing ${extension}`);
	return exec(`code --install-extension ${extension}`);
};

const uninstallExtension = extension => {
	console.log(`♻ Uninstalling ${extension}`);
	return exec(`code --uninstall-extension ${extension}`);
};

/* COMMANDS */

const saveSettings = () => {
	console.log('💾 Saving settings...');

	return copyFile(
		path.join(getPathToConfig(), 'settings.json'),
		'./settings.json',
	)
		.then(() => console.log('✅ Success!'))
		.catch(console.error);
};

const saveKeyBindings = () => {
	console.log('💾 Saving key bindings...');

	return copyFile(
		path.join(getPathToConfig(), 'keybindings.json'),
		'./keybindings.json',
	)
		.then(() => console.log('✅ Success!'))
		.catch(console.error);
};

const applySettings = () => {
	console.log('🚐 Applying settings...');

	return copyFile(
		'./settings.json',
		path.join(getPathToConfig(), 'settings.json'),
	)
		.then(() => console.log('✅ Success!'))
		.catch(console.error);
};

const applyKeyBindings = () => {
	console.log('🚐 Applying key bindings...');

	return copyFile(
		'./keybindings.json',
		path.join(getPathToConfig(), 'keybindings.json'),
	)
		.then(() => console.log('✅ Success!'))
		.catch(console.error);
};

const saveExtensions = () => {
	console.log('💾 Saving extensions list...');

	return readInstalledExtensions()
		.then(list => writeFile('extensions', list))
		.then(() => console.log('✅ Success!'))
		.catch(console.error);
};

const installExtensions = () => {
	console.log('🚚 Installing extensions...');
	console.log('---');

	let extensionsToInstall = [];
	let extensionsToUninstall = [];

	const rl = require('readline').createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	readInstalledExtensions()
		.then(installedExtensionsStr => {
			const installedExtensions = transformExtensionsStringToArray(
				installedExtensionsStr,
			);

			const savedExtensions = transformExtensionsStringToArray(
				readFileSync('./extensions', {encoding: 'utf8'}),
			);

			if (!savedExtensions.length) {
				console.log('`extensions` file is empty');
				process.exit(1);
			}

			extensionsToInstall = diff(installedExtensions, savedExtensions);
			extensionsToUninstall = diff(savedExtensions, installedExtensions);

			if (!extensionsToUninstall.length && !extensionsToInstall.length) {
				console.log('🎉 Nothing to install and uninstall');
				process.exit(0);
			}

			return new Promise(resolve =>
				rl.question(
					[
						extensionsToInstall.length
							? `📦 Extensions to install (${
									extensionsToInstall.length
							  }):\n${extensionsToInstall.join('\n')}\n`
							: '📦 Nothing to install\n',

						'---\n',

						extensionsToUninstall.length
							? `♻ Extensions to uninstall (${
									extensionsToUninstall.length
							  }):\n${extensionsToUninstall.join('\n')}\n`
							: '♻ Nothing to uninstall\n',

						'---\n',

						'🙏 Are you sure you want to continue? (y/N): ',
					].join(''),

					answer => resolve(answer),
				),
			);
		})

		.then(answer => {
			rl.close();

			if (answer !== 'y') {
				process.exit(0);
			}

			return Promise.all(extensionsToInstall.map(installExtension));
		})

		.then(() => Promise.all(extensionsToUninstall.map(uninstallExtension)))
		.then(() =>
			console.log('✅ Success! Restart vs-code to apply extensions.'),
		)
		.catch(console.error);
};

const applyAll = () => {
	applySettings()
		.then(applyKeyBindings)
		.then(installExtensions);
};

const saveAll = () => {
	saveSettings()
		.then(saveKeyBindings)
		.then(saveExtensions);
};

const commands = {
	'apply-all': applyAll,
	'save-all': saveAll,
	'save-settings': saveSettings,
	'apply-settings': applySettings,
	'save-extensions': saveExtensions,
	'install-extensions': installExtensions,

	__unknown__: () => {
		console.log('🧐 Unknown command!');
		process.exit(0);
	},
};

const [, , command] = process.argv;
const run = command in commands ? commands[command] : commands.__unknown__;
run();
