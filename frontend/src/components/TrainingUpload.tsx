import { useState } from 'react';
import { apiUploadTraining } from '../api';

// TrainingUpload allows admins to upload new question-SQL pairs for training.
// It requires a valid JWT token with appropriate permissions.
export default function TrainingUpload() {
  const [question, setQuestion] = useState('');
  const [sql, setSql] = useState('');
  const [metadata, setMetadata] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    try {
      const metaObj = metadata ? JSON.parse(metadata) : undefined;
      setLoading(true);
      const resp = await apiUploadTraining({ question, sql, metadata: metaObj });
      const data = await resp.json();
      if (resp.ok) {
        setMessage(data.message || 'Training item uploaded successfully');
        setQuestion('');
        setSql('');
        setMetadata('');
      } else {
        setError(data.message || 'Failed to upload training');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload training');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Upload Training Data</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="form-group">
          <label htmlFor="train-question">Question</label>
          <textarea
            id="train-question"
            rows={2}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Enter the training question"
          />
        </div>
        <div className="form-group">
          <label htmlFor="train-sql">SQL</label>
          <textarea
            id="train-sql"
            rows={3}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            placeholder="Enter the corresponding SQL query"
          />
        </div>
        <div className="form-group">
          <label htmlFor="train-metadata">Metadata (JSON)</label>
          <textarea
            id="train-metadata"
            rows={3}
            value={metadata}
            onChange={(e) => setMetadata(e.target.value)}
            placeholder="Optional metadata as JSON"
          />
        </div>
        {message && (
          <div className="bg-green-100 text-green-700 p-2 rounded">
            {message}
          </div>
        )}
        {error && (
          <div className="bg-red-100 text-red-700 p-2 rounded">
            {error}
          </div>
        )}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Uploading...' : 'Upload'}
        </button>
      </form>
    </div>
  );
}