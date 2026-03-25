import React from 'react';
import { X } from 'lucide-react';
import ConfigEditor from './ConfigEditor';

interface ConfigModalProps {
  type: 'vm' | 'lxc';
  id: string;
  onClose: () => void;
}

export default function ConfigModal({ type, id, onClose }: ConfigModalProps) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xl font-bold text-slate-900">Edit Configuration: {id}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-6 h-6" /></button>
        </div>
        <div className="p-6">
          <ConfigEditor type={type} id={id} />
        </div>
      </div>
    </div>
  );
}
