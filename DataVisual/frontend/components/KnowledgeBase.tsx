import React, { useState, useRef, useEffect } from 'react';
import { Dataset } from '../types';
import { Book, MessageSquare, Send, User, Bot, HelpCircle } from 'lucide-react';
import { answerKnowledgeBaseQuestion } from '../services/geminiService';

interface KnowledgeBaseProps {
  datasets: Dataset[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

const KnowledgeBase: React.FC<KnowledgeBaseProps> = ({ datasets }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: "Hello! I'm your Data Steward AI. Ask me anything about the datasets, metric definitions, or how to join tables.",
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    const answer = await answerKnowledgeBaseQuestion(userMsg.text, datasets);

    const aiMsg: Message = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      text: answer,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  return (
    <div className="flex h-full bg-slate-900">
      {/* Doc Navigation */}
      <div className="w-80 border-r border-slate-800 bg-slate-950 hidden md:flex flex-col">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Book className="text-purple-500" />
            <span>Knowledge Base</span>
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Getting Started</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="hover:text-white cursor-pointer hover:bg-slate-900 p-2 rounded transition-colors">Platform Overview</li>
              <li className="hover:text-white cursor-pointer hover:bg-slate-900 p-2 rounded transition-colors">Connecting Data Sources</li>
              <li className="hover:text-white cursor-pointer hover:bg-slate-900 p-2 rounded transition-colors">Creating Dashboards</li>
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Dataset Documentation</h3>
            <ul className="space-y-2 text-sm text-slate-400">
              {datasets.map(ds => (
                <li key={ds.id} className="hover:text-white cursor-pointer hover:bg-slate-900 p-2 rounded transition-colors flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                    {ds.name}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-600 text-center">
            Last updated: Today
        </div>
      </div>

      {/* Chat / Content Area */}
      <div className="flex-1 flex flex-col bg-slate-900">
         {/* Chat Interface */}
         <div className="flex-1 flex flex-col overflow-hidden relative">
            <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm z-0 pointer-events-none" />
            
            {/* Header */}
            <div className="h-16 border-b border-slate-800 flex items-center px-6 z-10 bg-slate-900 shadow-sm">
                <HelpCircle className="text-slate-400 mr-2" size={20} />
                <h3 className="font-semibold text-slate-200">Data Assistant</h3>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 z-10" ref={scrollRef}>
                {messages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`flex max-w-2xl ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'} items-start gap-3`}>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-blue-600' : 'bg-purple-600'}`}>
                                {msg.role === 'user' ? <User size={14} className="text-white" /> : <Bot size={14} className="text-white" />}
                            </div>
                            <div className={`p-4 rounded-2xl ${
                                msg.role === 'user' 
                                ? 'bg-blue-600 text-white rounded-tr-none' 
                                : 'bg-slate-800 text-slate-200 rounded-tl-none border border-slate-700'
                            }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                                <span className="text-[10px] opacity-50 mt-2 block">{msg.timestamp.toLocaleTimeString()}</span>
                            </div>
                        </div>
                    </div>
                ))}
                {isTyping && (
                   <div className="flex justify-start">
                     <div className="bg-slate-800 p-4 rounded-2xl rounded-tl-none border border-slate-700 ml-11">
                       <div className="flex space-x-2">
                         <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce"></div>
                         <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-75"></div>
                         <div className="w-2 h-2 bg-slate-500 rounded-full animate-bounce delay-150"></div>
                       </div>
                     </div>
                   </div>
                )}
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-800 bg-slate-900 z-10">
                <div className="relative max-w-4xl mx-auto">
                    <input 
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask about table relationships, column definitions, or analytics logic..."
                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl pl-4 pr-12 py-4 focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-lg"
                    />
                    <button 
                        onClick={handleSend}
                        disabled={!input.trim() || isTyping}
                        className="absolute right-3 top-3 p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:hover:bg-purple-600 transition-all"
                    >
                        <Send size={18} />
                    </button>
                </div>
                <p className="text-center text-xs text-slate-600 mt-2">
                    AI can make mistakes. Please verify important data definitions in the catalog.
                </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default KnowledgeBase;
