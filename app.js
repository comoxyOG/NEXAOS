const sails = require('sails');
const NeoLog = require('./structs/NeoLog');
const { default: axios } = require('axios');
const fs = require("fs").promises;
const path = require("path");
const https = require('https');

async function compareAndUpdateKeychain() {
    const keychain = JSON.parse(await fs.readFile("./responses/keychain.json", "utf-8"));
    const response = await axios.get('https://fortnitecentral.genxgames.gg/api/v1/aes', {validateStatus: () => true});    
    if (response.status === 200) {
        const data = response.data;

        let missingCount = 0;
        const keychainArray = [];

        for (const keys of data.dynamicKeys) {
            if (!keychain.includes(keys.keychain)) {
                missingCount++;
                keychainArray.push(keys.keychain);
            }
        }
        keychain.push(...keychainArray);

        await fs.writeFile("./responses/keychain.json", JSON.stringify(keychain, null, 2));
        NeoLog.Debug(`Fetched ${missingCount} New Keychains from Fortnite Central.`);
    } 
    else if (response.status !== 200) {
        NeoLog.Error("Fortnite Central is down, falling back to dillyapis for the keychain");
        const fallbackResponse = await axios.get('https://export-service.dillyapis.com/v1/aes', {validateStatus: () => true});
        if (fallbackResponse.status === 200) {
            const data = fallbackResponse.data
            let missingCount = 0;
            const keychainArray = [];

            for (const keys of data.dynamicKeys) {
                if (!keychain.includes(keys.keychain)) {
                    missingCount++;
                    keychainArray.push(keys.keychain);
                }
            }
            keychain.push(...keychainArray);
            await fs.writeFile("./responses/keychain.json", JSON.stringify(keychain, null, 2));
            NeoLog.Debug(`Fetched ${missingCount} New Keychains From dillyapis`);
        }
        else 
        {
            NeoLog.Error("Unable to connect to both Fortnite Central and dillyapis! Falling back to existing keychains on your local disk. You may experience issues!");
        }
    }
}

function fetchrawContent(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      let rawData = '';
      response.on('data', (chunk) => (rawData += chunk));
      response.on('end', () => resolve(rawData));
    }).on('error', (error) => reject(error));
  });
}

async function updateBackend() {
	const baseGitHubRawUrl = 'https://raw.githubusercontent.com/HybridFNBR/Neonite/main';
  
	const filesDirs = [
    { source: 'discovery', destination: 'discovery' },
	  { source: 'api/controllers', destination: 'api/controllers' },
	  { source: 'config', destination: 'config' },
	  { source: 'hotfixes', destination: 'hotfixes' },
	];
	await Promise.all(filesDirs.map(async (task) => {
	  const sourcePath = path.join(__dirname, task.source);
	  const destinationPath = path.join(__dirname, task.destination);
  
	  try {
		const files = await fs.readdir(sourcePath);
  
		await Promise.all(files.map(async (file) => {
		  const rawUrl = `${baseGitHubRawUrl}/${task.source}/${file}`;
		  const rawContent = await fetchrawContent(rawUrl);
		  await fs.writeFile(path.join(destinationPath, file), rawContent);
		}));
  
		NeoLog.Debug(`Updated files in ${task.destination}`);
	  } catch (error) {
		NeoLog.Debug(`Error updating files in ${task.destination}: ${error.message}`);
	  }
	}));
}
async function startBackend() {
  sails.lift({
    port: 5595,
    environment: "production",
    hooks: {
      session: false,
    },
    log: {
      level: 'silent',
    },
  }, (err) => {
    if (err) {
      console.log(err);
    }
  });
}

async function runFunctions() {
    await updateBackend();
    await compareAndUpdateKeychain();
    await startBackend();
}
runFunctions();
