/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  Search, 
  Zap, 
  FileText, 
  HelpCircle, 
  MessageSquare, 
  Layers,
  Terminal,
  Code2,
  FileCode
} from 'lucide-react';
import { motion } from 'motion/react';

const Nav = () => (
  <nav className="flex items-center justify-between px-8 py-6 max-w-7xl mx-auto w-full">
    <div className="flex items-center gap-2">
      <div className="bg-[#0B1B2B] text-white p-1.5 rounded font-bold text-sm">SN</div>
      <span className="font-semibold text-lg tracking-tight">SN Assistant</span>
    </div>
    <div className="flex gap-8 text-sm font-medium text-gray-600">
      <a href="#" className="hover:text-black transition-colors">Privacy</a>
      <a href="#" className="hover:text-black transition-colors">Terms</a>
      <a href="#" className="hover:text-black transition-colors">Support</a>
      <a href="#" className="hover:text-black transition-colors flex items-center gap-1">
        GitHub
      </a>
    </div>
  </nav>
);

const Hero = () => (
  <section className="px-8 py-16 max-w-7xl mx-auto w-full grid lg:grid-cols-[1fr,400px] gap-12 items-start">
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
    >
      <h1 className="font-serif text-5xl lg:text-6xl leading-[1.1] mb-8 max-w-2xl">
        Built for ServiceNow work that has to hold up in real delivery.
      </h1>
      <p className="text-xl text-gray-600 mb-10 max-w-lg leading-relaxed">
        ServiceNow and probably use ServiceNow work that has to hold up in real delivery.
      </p>
      <div className="flex flex-wrap gap-4">
        <button className="bg-[#0B1B2B] text-white px-6 py-3 rounded-md font-medium hover:bg-opacity-90 transition-all cursor-pointer">
          View repository
        </button>
        <button className="border border-gray-300 px-6 py-3 rounded-md font-medium hover:bg-gray-50 transition-all cursor-pointer">
          Read support scope
        </button>
      </div>
    </motion.div>

    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="bg-[#0B1B2B] text-white p-8 rounded-xl shadow-2xl"
    >
      <div className="text-xs font-bold tracking-widest uppercase opacity-60 mb-6">Public Release</div>
      
      <div className="space-y-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-[1px] w-6 bg-blue-400"></div>
            <h3 className="font-semibold">Release section</h3>
          </div>
          <p className="text-sm opacity-70 leading-relaxed ml-9">
            Collect ServiceNow standard use next-gen to match delivery, control development, use tight analytics.
          </p>
        </div>

        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="h-[1px] w-6 bg-blue-400"></div>
            <h3 className="font-semibold">Extras section</h3>
          </div>
          <p className="text-sm opacity-70 leading-relaxed ml-9">
            Underwriting active actions is also highly variable, goals support.
          </p>
        </div>
      </div>
    </motion.div>
  </section>
);

const FeatureCard = ({ icon: Icon, title, description }: { icon: any, title: string, description: string }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white p-6 rounded-lg border border-gray-100 shadow-sm flex flex-col gap-4"
  >
    <div className="flex justify-between items-start">
      <div className="p-2 bg-blue-50 text-blue-600 rounded-md">
        <Icon size={20} />
      </div>
      <div className="h-[1px] w-6 bg-blue-200 mt-3"></div>
    </div>
    <div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-gray-500 leading-relaxed">
        {description}
      </p>
    </div>
  </motion.div>
);

const WhatItDoes = () => (
  <section className="px-8 py-20 max-w-7xl mx-auto w-full">
    <div className="mb-12">
      <span className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4 block">What it does</span>
      <h2 className="font-serif text-4xl">Less guessing. More useful platform work.</h2>
    </div>
    
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
      <FeatureCard 
        icon={Search} 
        title="Explain" 
        description="Explain none of the ServiceNow so help you sell motion the maining." 
      />
      <FeatureCard 
        icon={Zap} 
        title="Refactor" 
        description="Refactor and thenor raviguration will be adapt your document developers." 
      />
      <FeatureCard 
        icon={FileText} 
        title="Document" 
        description="Document the document minor work, completions and understanding documents." 
      />
      <FeatureCard 
        icon={HelpCircle} 
        title="Ask" 
        description="Ask as time of your question. Ask what's your truth." 
      />
      <FeatureCard 
        icon={MessageSquare} 
        title="Comment" 
        description="Comment since using a comment and comment the problems." 
      />
      <FeatureCard 
        icon={Layers} 
        title="Document UpdateSet" 
        description="Document updateSet file document updateSet to prepare." 
      />
    </div>
  </section>
);

const SupportScopeCard = ({ icon: Icon, title, description, code }: { icon: any, title: string, description: string, code: string }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden"
  >
    <div className="p-6">
      <div className="flex items-center gap-3 mb-4">
        <Icon size={20} className="text-blue-600" />
        <h3 className="font-semibold">{title}</h3>
      </div>
      <p className="text-sm text-gray-500 leading-relaxed mb-6">
        {description}
      </p>
    </div>
    <div className="bg-[#0B1B2B] p-3 px-6 text-xs font-mono text-blue-300/80 flex items-center gap-2">
      <span className="opacity-50">$</span> {code}
    </div>
  </motion.div>
);

const SupportScope = () => (
  <section className="px-8 py-20 max-w-7xl mx-auto w-full border-t border-gray-200">
    <div className="mb-12">
      <span className="text-xs font-bold tracking-widest uppercase text-gray-400 mb-4 block">Public Support Scope</span>
      <h2 className="font-serif text-4xl max-w-2xl">Only what is verified gets promised in support scope.</h2>
    </div>

    <div className="grid md:grid-cols-2 gap-8">
      <SupportScopeCard 
        icon={Terminal}
        title="Business Rules"
        description="Business rules verified that your business rules."
        code="sys_update_set"
      />
      <SupportScopeCard 
        icon={Code2}
        title="Script Includes"
        description="Script Includes with all you promoted script support issues."
        code="sys_script"
      />
      <SupportScopeCard 
        icon={FileCode}
        title="Script Codes"
        description="Preventing software script includes."
        code="sys_update_set"
      />
      <SupportScopeCard 
        icon={Layers}
        title="Script UpdateSet"
        description="Script units promised in support includes."
        code="sys_script"
      />
    </div>
  </section>
);

export default function App() {
  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA]">
      <Nav />
      <main className="flex-grow">
        <Hero />
        <WhatItDoes />
        <SupportScope />
      </main>
      <footer className="px-8 py-12 max-w-7xl mx-auto w-full border-t border-gray-200 text-sm text-gray-400 flex justify-between items-center">
        <p>© 2026 SN Assistant. All rights reserved.</p>
        <div className="flex gap-6">
          <a href="#" className="hover:text-black transition-colors">Privacy</a>
          <a href="#" className="hover:text-black transition-colors">Terms</a>
        </div>
      </footer>
    </div>
  );
}
