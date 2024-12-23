import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import Store from 'electron-store';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const store = new Store();

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('save-barcode', async (event, data) => {
  const savedBarcodes = store.get('barcodes') || [];
  store.set('barcodes', [...savedBarcodes, data]);
  return true;
});

ipcMain.handle('get-barcodes', async () => {
  return store.get('barcodes') || [];
});

ipcMain.handle('export-barcode', async (event, { data, format }) => {
  const { filePath } = await dialog.showSaveDialog({
    defaultPath: `barcode.${format}`,
    filters: [
      { name: format.toUpperCase(), extensions: [format] }
    ]
  });

  if (filePath) {
    writeFileSync(filePath, Buffer.from(data.split(',')[1], 'base64'));
  }
  return filePath;
});