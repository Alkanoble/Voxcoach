import { useRef, useState } from 'react';

export default function FileUploader({ onFileSelected }) {
  const fileRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState(null);

  const handleFile = (file) => {
    if (file && file.type.startsWith('audio/')) {
      setFileName(file.name);
      onFileSelected(file);
    } else {
      alert('Please select an audio file.');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div
      className={`file-uploader ${dragOver ? 'drag-over' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
    >
      <input
        ref={fileRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={(e) => e.target.files[0] && handleFile(e.target.files[0])}
      />
      {fileName ? (
        <p>Selected: <strong>{fileName}</strong></p>
      ) : (
        <p>Drag & drop an audio file here, or click to browse</p>
      )}
    </div>
  );
}
