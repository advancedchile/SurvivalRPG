import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Info, X } from 'lucide-react';

interface NotificationType {
  id: number;
  message: string;
}

interface NotificationsProps {
  notifications: NotificationType[];
  removeNotification: (id: number) => void;
}

export function Notifications({ notifications, removeNotification }: NotificationsProps) {
  return (
    <div className="absolute top-4 left-4 flex flex-col gap-2 z-50 pointer-events-auto">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div 
            key={n.id}
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -20, opacity: 0 }}
            className="bg-white text-black px-4 py-3 rounded text-[10px] font-sans flex items-center justify-between gap-6 shadow-sm min-w-[250px] border border-gray-100"
          >
            <div className="flex items-center gap-3">
              <Info size={14} className="text-gray-400" />
              {n.message}
            </div>
            <button onClick={() => removeNotification(n.id)} className="hover:bg-gray-100 rounded-full p-1 opacity-50 hover:opacity-100 transition-opacity">
              <X size={12} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
