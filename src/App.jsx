import React, { useState, useEffect } from 'react';
import JsBarcode from 'jsbarcode';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
const { ipcRenderer } = window.require('electron');

const App = () => {
  const [barcodeType, setBarcodeType] = useState('jan');
  const [barcodeValue, setBarcodeValue] = useState('');
  const [savedBarcodes, setSavedBarcodes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeSize, setBarcodeSize] = useState({
    width: 2,
    height: 100
  });
  const [bulkInput, setBulkInput] = useState('');
  const [showBulkInput, setShowBulkInput] = useState(false);

  useEffect(() => {
    loadSavedBarcodes();
  }, []);

  const loadSavedBarcodes = async () => {
    const barcodes = await ipcRenderer.invoke('get-barcodes');
    setSavedBarcodes(barcodes);
  };

  const generateBarcode = (value = barcodeValue) => {
    const canvas = document.createElement('canvas');
    
    try {
      JsBarcode(canvas, value, {
        format: getBarcodeFormat(),
        width: barcodeSize.width,
        height: barcodeSize.height,
        displayValue: true
      });
      
      const barcodeData = {
        type: barcodeType,
        value: value,
        image: canvas.toDataURL(),
        timestamp: new Date().toISOString(),
        size: barcodeSize
      };
      
      saveBarcodeData(barcodeData);
      return barcodeData;
    } catch (error) {
      alert(`バーコードの生成に失敗しました: ${value}`);
      return null;
    }
  };

  const getBarcodeFormat = () => {
    switch(barcodeType) {
      case 'jan': return 'ean13';
      case 'itf': return 'itf14';
      case 'gs1': return 'databar';
      default: return 'ean13';
    }
  };

  const saveBarcodeData = async (data) => {
    await ipcRenderer.invoke('save-barcode', data);
    loadSavedBarcodes();
  };

  const handleBulkGenerate = () => {
    const values = bulkInput.split('\n').filter(v => v.trim());
    const generatedBarcodes = values.map(value => generateBarcode(value.trim()))
      .filter(barcode => barcode !== null);
    
    setBulkInput('');
    setShowBulkInput(false);
  };

  const handleExport = async (barcode, format) => {
    let exportData;
    
    if (format === 'pdf') {
      const pdf = new jsPDF();
      const img = new Image();
      img.src = barcode.image;
      pdf.addImage(img, 'PNG', 10, 10, 190, 50);
      exportData = pdf.output('datauristring');
    } else {
      exportData = barcode.image;
    }

    await ipcRenderer.invoke('export-barcode', { 
      data: exportData, 
      format 
    });
  };

  const handleBulkExport = async (format) => {
    if (format === 'xlsx') {
      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(savedBarcodes.map(b => ({
        Type: b.type,
        Value: b.value,
        Generated: new Date(b.timestamp).toLocaleString()
      })));
      XLSX.utils.book_append_sheet(wb, ws, 'Barcodes');
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      await ipcRenderer.invoke('export-barcode', {
        data: `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${wbout}`,
        format: 'xlsx'
      });
    } else {
      const pdf = new jsPDF();
      savedBarcodes.forEach((barcode, index) => {
        if (index > 0) pdf.addPage();
        const img = new Image();
        img.src = barcode.image;
        pdf.addImage(img, 'PNG', 10, 10, 190, 50);
        pdf.text(`Type: ${barcode.type}`, 10, 70);
        pdf.text(`Value: ${barcode.value}`, 10, 80);
      });
      await ipcRenderer.invoke('export-barcode', {
        data: pdf.output('datauristring'),
        format: 'pdf'
      });
    }
  };

  const filteredBarcodes = savedBarcodes.filter(barcode => {
    const query = searchQuery.toLowerCase();
    return (
      barcode.value.toLowerCase().includes(query) ||
      barcode.type.toLowerCase().includes(query)
    );
  });

  return (
    <div className="container">
      <h1>バーコードジェネレーター</h1>
      
      <div className="input-section">
        <select 
          value={barcodeType} 
          onChange={(e) => setBarcodeType(e.target.value)}
        >
          <option value="jan">JANコード</option>
          <option value="itf">ITFコード</option>
          <option value="gs1">GS1データバー限定型</option>
        </select>
        
        <div className="size-controls">
          <label>
            幅:
            <input
              type="number"
              value={barcodeSize.width}
              onChange={(e) => setBarcodeSize({...barcodeSize, width: Number(e.target.value)})}
              min="1"
              max="10"
            />
          </label>
          <label>
            高さ:
            <input
              type="number"
              value={barcodeSize.height}
              onChange={(e) => setBarcodeSize({...barcodeSize, height: Number(e.target.value)})}
              min="50"
              max="200"
            />
          </label>
        </div>

        {!showBulkInput ? (
          <>
            <input
              type="text"
              value={barcodeValue}
              onChange={(e) => setBarcodeValue(e.target.value)}
              placeholder="バーコード番号を入力"
            />
            <button onClick={() => generateBarcode()}>
              バーコード生成
            </button>
            <button onClick={() => setShowBulkInput(true)}>
              一括生成モード
            </button>
          </>
        ) : (
          <>
            <textarea
              value={bulkInput}
              onChange={(e) => setBulkInput(e.target.value)}
              placeholder="バーコード番号を1行ごとに入力"
              rows="5"
            />
            <button onClick={handleBulkGenerate}>
              一括生成
            </button>
            <button onClick={() => setShowBulkInput(false)}>
              通常モードに戻る
            </button>
          </>
        )}
      </div>

      <div className="search-section">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="バーコードを検索..."
        />
        <div className="export-buttons">
          <button onClick={() => handleBulkExport('pdf')}>
            全てPDFで出力
          </button>
          <button onClick={() => handleBulkExport('xlsx')}>
            一覧をExcelで出力
          </button>
        </div>
      </div>

      <div className="saved-barcodes">
        <h2>保存済みバーコード ({filteredBarcodes.length}件)</h2>
        {filteredBarcodes.map((barcode, index) => (
          <div key={index} className="saved-barcode">
            <div className="barcode-info">
              <p>タイプ: {barcode.type}</p>
              <p>値: {barcode.value}</p>
              <p>生成日時: {new Date(barcode.timestamp).toLocaleString()}</p>
            </div>
            <img src={barcode.image} alt="バーコード" />
            <div className="barcode-actions">
              <button onClick={() => handleExport(barcode, 'png')}>
                PNG出力
              </button>
              <button onClick={() => handleExport(barcode, 'pdf')}>
                PDF出力
              </button>
            </div>
          </div>
        ))}
      </div>

      <style jsx>{`
        .container {
          padding: 20px;
          max-width: 1200px;
          margin: 0 auto;
        }

        .input-section {
          margin-bottom: 20px;
        }

        .size-controls {
          margin: 10px 0;
          display: flex;
          gap: 20px;
        }

        .search-section {
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .export-buttons {
          display: flex;
          gap: 10px;
        }

        .saved-barcode {
          border: 1px solid #ccc;
          padding: 15px;
          margin-bottom: 15px;
          border-radius: 5px;
        }

        .barcode-info {
          margin-bottom: 10px;
        }

        .barcode-actions {
          margin-top: 10px;
          display: flex;
          gap: 10px;
        }

        button {
          padding: 5px 10px;
          cursor: pointer;
        }

        input, select, textarea {
          margin: 5px 0;
          padding: 5px;
        }

        textarea {
          width: 100%;
        }
      `}</style>
    </div>
  );
};

export default App;