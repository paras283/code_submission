import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Settings, Save, AlertCircle, CheckCircle, FileType } from 'lucide-react';

interface FileExtension {
  id: string;
  extension: string;
  mime_type: string;
  is_enabled: boolean;
}

interface FileExtensionManagerProps {
  onExtensionsUpdate: () => void;
}

export default function FileExtensionManager({ onExtensionsUpdate }: FileExtensionManagerProps) {
  const [extensions, setExtensions] = useState<FileExtension[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchExtensions();
  }, []);

  const fetchExtensions = async () => {
    try {
      const { data, error } = await supabase
        .from('file_extensions')
        .select('*')
        .order('extension');

      if (error) throw error;
      setExtensions(data || []);
    } catch (error) {
      console.error('Error fetching extensions:', error);
      setMessage({ type: 'error', text: 'Failed to load file extensions' });
    } finally {
      setLoading(false);
    }
  };

  const toggleExtension = (id: string, enabled: boolean) => {
    setExtensions(prev => 
      prev.map(ext => 
        ext.id === id ? { ...ext, is_enabled: enabled } : ext
      )
    );
  };

  const saveChanges = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const updates = extensions.map(ext => ({
        id: ext.id,
        is_enabled: ext.is_enabled
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('file_extensions')
          .update({ is_enabled: update.is_enabled })
          .eq('id', update.id);

        if (error) throw error;
      }

      setMessage({ type: 'success', text: 'File extensions updated successfully!' });
      onExtensionsUpdate();
    } catch (error) {
      console.error('Error saving extensions:', error);
      setMessage({ type: 'error', text: 'Failed to save changes' });
    } finally {
      setSaving(false);
    }
  };

  const getExtensionIcon = (extension: string) => {
    const iconMap: { [key: string]: string } = {
      'py': '🐍',
      'doc': '📄',
      'docx': '📄',
      'ppt': '📊',
      'pptx': '📊',
      'pdf': '📕',
      'xls': '📈',
      'xlsx': '📈'
    };
    return iconMap[extension] || '📄';
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
        <div className="flex items-center">
          <Settings className="w-6 h-6 text-white mr-3" />
          <h2 className="text-xl font-bold text-white">File Extension Settings</h2>
        </div>
        <p className="text-blue-100 mt-1">Configure which file types students can upload</p>
      </div>

      <div className="p-6">
        {message && (
          <div className={`mb-6 p-4 rounded-lg flex items-center ${
            message.type === 'success' 
              ? 'bg-green-50 text-green-800 border border-green-200' 
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}>
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5 mr-2" />
            ) : (
              <AlertCircle className="w-5 h-5 mr-2" />
            )}
            {message.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {extensions.map((ext) => (
            <div
              key={ext.id}
              className={`border-2 rounded-lg p-4 transition-all duration-200 ${
                ext.is_enabled
                  ? 'border-green-300 bg-green-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">{getExtensionIcon(ext.extension)}</span>
                  <div>
                    <p className="font-semibold text-gray-900 uppercase">
                      .{ext.extension}
                    </p>
                    <p className="text-xs text-gray-600">{ext.mime_type}</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ext.is_enabled}
                    onChange={(e) => toggleExtension(ext.id, e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-600">
            <FileType className="w-4 h-4 inline mr-1" />
            {extensions.filter(ext => ext.is_enabled).length} of {extensions.length} extensions enabled
          </div>
          <button
            onClick={saveChanges}
            disabled={saving}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}