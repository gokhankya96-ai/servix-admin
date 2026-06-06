console.log(`
Temiz kurulum komutları (PowerShell):

rmdir /s /q node_modules
del package-lock.json
npm install
npm run rebuild
npm start

Production build:

npm run preflight
npm run dist
`);
