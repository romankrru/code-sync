const {promisify} = require('util');
const path = require('path');
const {readFileSync} = require('fs');
const exec = promisify(require('child_process').exec);
const writeFile = promisify(require('fs').writeFile);
const copyFile = promisify(require('fs').copyFile);
const homedir = require('os').homedir();

const rl = require('readline').createInterface({
	input: process.stdin,
	output: process.stdout
});

const getPathToSettings = () => {
	const common = ['Code', 'User', 'settings.json'];

	if(process.platform === "win32")
		return path.join(homedir, 'AppData', 'Roaming', ...common);

	return path.join(homedir, '.config', ...common);
}

const readInstalledExtensions = () => exec('code --list-extensions')

		.then(({stdout, stderr}) => {
			if(stderr) {
				console.log(`Unable to get extensions. stderr: ${stderr}`);
				process.exit(1);
			}

			return stdout;
		})

		.catch(console.error);

const transformExtensionsStringToArray = extensionsString => extensionsString
	.split('\n')
	.filter(Boolean); // exclude empty strings

const ask = question => new Promise(resolve => rl.question(question, answer => resolve(answer)));

const installExtension = extension => {
	console.log(`Installing ${extension}`);
	return exec(`code --install-extension ${extension}`);
};

const uninstallExtension = extension => {
	console.log(`Uninstalling ${extension}`);
	return exec(`code --uninstall-extension ${extension}`);
};

const [,,command] = process.argv;

const commands = {
	'save-settings': () => {
		rl.close();

		console.log('Saving settings...');

		copyFile(getPathToSettings(), './settings.json')
			.then(() => console.log('Success!'))
			.catch(console.error);
	},

	'apply-settings': () => {
		rl.close();

		console.log('Applying settings...')

		copyFile('./settings.json', getPathToSettings())
			.then(() => console.log('Success!'))
			.catch(console.error);
	},

	'save-extensions': () => {
		console.log('Saving extensions list...');

		readInstalledExtensions()
			.then(list => writeFile('extensions', list))
			.then(() => console.log('Success!'))
			.catch(console.error);
	},

	'install-extensions': () => {
		console.log('Installing extensions...')
		console.log('---')

		let extensionsToInstall = [];
		let extensionsToUninstall = [];

		readInstalledExtensions()

			.then(installedExtensionsStr => {
				const installedExtensions = transformExtensionsStringToArray(installedExtensionsStr);
				const savedExtensions = transformExtensionsStringToArray(readFileSync('./extensions', {encoding: 'utf8'}));

				if(!savedExtensions.length) {
					console.log('`extensions` file is empty');
					process.exit(1);
				}

				extensionsToInstall = savedExtensions.reduce((acc, extensionName) => {
					if(installedExtensions.includes(extensionName))
						return acc;

					acc.push(extensionName);
					return acc;
				}, []);

				extensionsToUninstall = installedExtensions.reduce((acc, extensionName) => {
					if(savedExtensions.includes(extensionName))
						return acc;

					acc.push(extensionName);
					return acc;
				}, []);

				if(!extensionsToUninstall.length && !extensionsToInstall.length) {
					console.log('Nothing to install and uninstall');
					process.exit(0);
				}

				return ask([
						extensionsToInstall.length
							? `Extensions to install (${extensionsToInstall.length}):\n ${extensionsToInstall.join('\n')} \n`
							: 'Nothing to install \n',

						'---\n',

						extensionsToUninstall.length
							? `Extensions to uninstall (${extensionsToUninstall.length}):\n ${extensionsToUninstall.join('\n')} \n`
							: 'Nothing to uninstall \n',

						'---\n',

						'Are you sure you want to continue? (y/N): '
				].join(''));
			})

			.then(answer => {
				rl.close();

				if(answer !== 'y') {
					process.exit(0);
				}

				return Promise.all(extensionsToInstall.map(installExtension));
			})


			.then(() => Promise.all(extensionsToUninstall.map(uninstallExtension)))
			.then(() => console.log('Success!'))
			.catch(console.error);
	},

	__unknown__: () => {
		console.log('Unknown command!');
		process.exit(0);
	},
};

const run = (command in commands) ? commands[command] : commands.__unknown__;
run();
