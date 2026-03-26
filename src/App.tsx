/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Home, 
  BookOpen, 
  Heart, 
  Settings, 
  ChevronRight, 
  Share2, 
  CheckCircle2, 
  Volume2, 
  ArrowLeft,
  Loader2,
  Sparkles,
  Bookmark,
  BookmarkCheck,
  User as UserIcon,
  Lock,
  Shield,
  PenTool,
  Calendar,
  LogOut,
  Plus,
  Trash2,
  Star,
  MessageCircle,
  Book
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { BibleTopic, Favorite, UserSettings, User, JournalEntry, StudyPlan, StudyPlanDay } from './types';
import { INITIAL_TOPICS } from './constants';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  serverTimestamp, 
  Timestamp,
  orderBy,
  limit
} from 'firebase/firestore';


export default function App() {
  const [activeTab, setActiveTab] = useState<'home' | 'temas' | 'favoritos' | 'config' | 'journal' | 'premium' | 'admin' | 'counselor' | 'bible'>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTopic, setSelectedTopic] = useState<BibleTopic | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<StudyPlan | null>(null);
  const [selectedPlanDays, setSelectedPlanDays] = useState<StudyPlanDay[]>([]);
  const [view, setView] = useState<'main' | 'results' | 'devotional' | 'login' | 'register' | 'plan-detail' | 'bible-reader'>('main');
  const [bibleContent, setBibleContent] = useState<any>(null);
  const [bibleBook, setBibleBook] = useState('João');
  const [bibleChapter, setBibleChapter] = useState(1);
  const [counselorQuestion, setCounselorQuestion] = useState('');
  const [counselorResponse, setCounselorResponse] = useState<any>(null);
  const [topics, setTopics] = useState<BibleTopic[]>([]);
  const [favorites, setFavorites] = useState<Favorite[]>([]);
  const [readDevotionals, setReadDevotionals] = useState<string[]>([]);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [studyPlans, setStudyPlans] = useState<StudyPlan[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [settings, setSettings] = useState<UserSettings>({
    language: 'simple',
    notifications: true,
    theme: 'light'
  });

  // Auth and Data Sync
  useEffect(() => {
    // Real-time Study Plans
    const unsubscribePlans = onSnapshot(collection(db, 'study_plans'), (snapshot) => {
      setStudyPlans(snapshot.docs.map(doc => ({ id: doc.id as any, ...doc.data() } as StudyPlan)));
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'study_plans'));

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Get or create user profile
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          setUser(userDoc.data() as User);
        } else {
          const newUser: User = {
            id: firebaseUser.uid as any,
            name: firebaseUser.displayName || 'Usuário',
            email: firebaseUser.email || '',
            role: 'user',
            created_at: new Date().toISOString()
          };
          await setDoc(doc(db, 'users', firebaseUser.uid), newUser);
          setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setIsAuthReady(true);
    });

    // Real-time Topics
    const unsubscribeTopics = onSnapshot(collection(db, 'topics'), (snapshot) => {
      const topicsData = snapshot.docs.map(doc => ({ id: doc.id as any, ...doc.data() } as BibleTopic));
      setTopics(topicsData.length > 0 ? topicsData : INITIAL_TOPICS);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'topics'));

    return () => {
      unsubscribeAuth();
      unsubscribeTopics();
      unsubscribePlans();
    };
  }, []);

  // Sync INITIAL_TOPICS if empty (Admin only)
  useEffect(() => {
    if (!user || user.role !== 'admin' || !isAuthReady) return;
    
    const syncInitialTopics = async () => {
      try {
        const snapshot = await getDocs(collection(db, 'topics'));
        if (snapshot.empty) {
          for (const topic of INITIAL_TOPICS) {
            await addDoc(collection(db, 'topics'), { ...topic, is_ai_generated: false });
          }
        }
      } catch (err) {
        console.error("Sync error:", err);
      }
    };
    syncInitialTopics();
  }, [user, isAuthReady]);

  // User-specific data
  useEffect(() => {
    if (!user || !isAuthReady) return;

    const unsubscribeFavs = onSnapshot(collection(db, 'users', user.id as any, 'favorites'), (snapshot) => {
      setFavorites(snapshot.docs.map(doc => ({ id: doc.id as any, ...doc.data() } as Favorite)));
    });

    const unsubscribeJournal = onSnapshot(
      query(collection(db, 'users', user.id as any, 'journal_entries'), orderBy('created_at', 'desc')), 
      (snapshot) => {
        setJournalEntries(snapshot.docs.map(doc => ({ id: doc.id as any, ...doc.data() } as JournalEntry)));
      }
    );

    const unsubscribeRead = onSnapshot(collection(db, 'users', user.id as any, 'read_devotionals'), (snapshot) => {
      setReadDevotionals(snapshot.docs.map(doc => doc.id));
    });

    let unsubscribeAllUsers: (() => void) | undefined;
    if (user.role === 'admin') {
      unsubscribeAllUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(doc => doc.data() as User));
      });
    }

    return () => {
      unsubscribeFavs();
      unsubscribeJournal();
      unsubscribeRead();
      if (unsubscribeAllUsers) unsubscribeAllUsers();
    };
  }, [user, isAuthReady]);

  const verseOfTheDay = useMemo(() => {
    const day = new Date().getDate();
    return topics[day % topics.length] || INITIAL_TOPICS[0];
  }, [topics]);

  const topicInFocus = useMemo(() => {
    const day = new Date().getDate();
    return topics[(day + 5) % topics.length] || INITIAL_TOPICS[1];
  }, [topics]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setErrorMessage(null);
    
    // Check local database first
    const localMatch = topics.find(t => 
      t.tema.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    if (localMatch) {
      setSelectedTopic(localMatch);
      setView('results');
      setIsLoading(false);
    } else {
      // Use AI to generate content
      try {
        const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '' });
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: `Gere um estudo bíblico prático sobre o tema: "${searchQuery}". O tom deve ser acolhedor e a linguagem deve ser ${settings.language === 'simple' ? 'muito simples e direta' : 'intermediária e reflexiva'}.
          
          IMPORTANTE:
          - A 'explicacao' deve ser detalhada, com pelo menos 3 parágrafos, explicando o significado profundo do versículo.
          - O 'contexto' deve trazer informações históricas, culturais ou literárias relevantes que ajudem a entender por que o versículo foi escrito daquela forma.
          - A 'aplicacao' deve ser muito prática, com passos concretos (pelo menos 3 dicas ou ações) para o dia a dia.
          - O 'devocional' deve ser uma história ou reflexão envolvente de tamanho médio.`,
          config: {
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                tema: { type: Type.STRING },
                versiculo: { type: Type.STRING },
                explicacao: { type: Type.STRING },
                contexto: { type: Type.STRING },
                aplicacao: { type: Type.STRING },
                devocional: { type: Type.STRING },
                oracao: { type: Type.STRING },
                perguntas: { type: Type.ARRAY, items: { type: Type.STRING } },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["tema", "versiculo", "explicacao", "aplicacao", "devocional", "oracao"]
            }
          }
        });

        const text = response.text || '{}';
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const cleanJson = jsonMatch ? jsonMatch[0] : text;
        const aiTopic = JSON.parse(cleanJson) as BibleTopic;
        aiTopic.is_ai_generated = true;

        // Try to save to Firestore (background)
        let savedTopic = { ...aiTopic, id: Date.now().toString() as any };
        try {
          const docRef = await addDoc(collection(db, 'topics'), aiTopic);
          savedTopic = { ...aiTopic, id: docRef.id as any };
        } catch (saveError) {
          console.warn("Could not save AI topic to Firestore:", saveError);
          // Still show it to the user even if save fails (e.g. permission denied)
        }
        
        setSelectedTopic(savedTopic);
        setView('results');
      } catch (error) {
        console.error("AI Error:", error);
        setErrorMessage("Desculpe, não conseguimos gerar esse estudo agora. Tente outro tema.");
      } finally {
        setIsLoading(false);
      }
    }
  };

  const toggleFavorite = async (topic: BibleTopic) => {
    if (!user) return;
    const existing = favorites.find(f => f.content_id === topic.id && f.type === 'topic');
    const favsRef = collection(db, 'users', user.id as any, 'favorites');
    
    if (existing) {
      await deleteDoc(doc(db, 'users', user.id as any, 'favorites', existing.id as any));
    } else {
      await addDoc(favsRef, {
        type: 'topic',
        content_id: topic.id,
        title: topic.tema,
        subtitle: topic.versiculo,
        created_at: new Date().toISOString()
      });
    }
  };

  const markAsRead = async (topicId: string) => {
    if (!user || readDevotionals.includes(topicId)) return;
    try {
      await setDoc(doc(db, 'users', user.id as any, 'read_devotionals', topicId), {
        read_at: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const askCounselor = async (question: string, type: 'counselor' | 'doubt' = 'counselor') => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '' });
      const isDoubt = type === 'doubt';
      const prompt = isDoubt 
        ? `O usuário tem esta dúvida bíblica: "${question}". 
           Responda de forma clara, acolhedora, sem linguagem teológica complicada. 
           Use referências bíblicas sempre que possível e conecte o ensinamento com a vida real.`
        : `O usuário está passando por esta situação ou tem esta dúvida: "${question}".
           Responda de forma acolhedora, clara e baseada nos ensinamentos de Jesus e princípios bíblicos.`;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              reflexao: { type: Type.STRING },
              versiculo: { type: Type.STRING },
              orientacao: { type: Type.STRING },
              oracao: { type: Type.STRING }
            },
            required: ["reflexao", "versiculo", "orientacao", "oracao"]
          }
        }
      });

      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : text;
      const data = JSON.parse(cleanJson);
      setCounselorResponse({ ...data, type });
      if (activeTab !== 'counselor') setActiveTab('counselor');
    } catch (error) {
      console.error("Counselor AI Error:", error);
      setErrorMessage("Desculpe, não conseguimos processar sua pergunta agora.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
      setView('main');
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao entrar com Google. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      setJournalEntries([]);
      setActiveTab('home');
      setView('main');
    } catch (e) {
      console.error(e);
      setErrorMessage("Erro ao sair.");
    }
  };

  const addJournalEntry = async (type: 'reflection' | 'prayer' | 'thought', content: string) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'users', user.id as any, 'journal_entries'), {
        type,
        content,
        created_at: new Date().toISOString()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteJournalEntry = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'users', user.id as any, 'journal_entries', id));
    } catch (e) {
      console.error(e);
    }
  };

  const renderPremium = () => {
    if (!user) {
      return (
        <div className="py-20 text-center space-y-6">
          <div className="w-20 h-20 bg-brand-blue/5 text-brand-blue rounded-full flex items-center justify-center mx-auto">
            <Star size={40} />
          </div>
          <div className="space-y-2">
            <h2 className={`text-2xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Conteúdo Premium</h2>
            <p className="text-stone-500 max-w-[250px] mx-auto">Acesse planos de estudo exclusivos criando sua conta gratuita.</p>
          </div>
          <button 
            onClick={() => setView('login')}
            className="px-8 py-3 bg-brand-blue text-white rounded-xl font-bold shadow-lg shadow-brand-blue/20"
          >
            Entrar Agora
          </button>
        </div>
      );
    }

    if (view === 'plan-detail' && selectedPlan) {
      return (
        <div className="space-y-6 pb-20">
          <button onClick={() => setView('main')} className={`p-2 -ml-2 ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-600'}`}>
            <ArrowLeft size={24} />
          </button>
          <div className="space-y-2">
            <span className="text-[10px] font-bold text-brand-blue uppercase tracking-widest">{selectedPlan.category}</span>
            <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{selectedPlan.title}</h1>
            <p className="text-stone-500">{selectedPlan.description}</p>
          </div>

          <div className="space-y-6">
            {selectedPlanDays.map(day => (
              <div key={day.id} className={`p-6 rounded-[32px] border shadow-sm space-y-4 ${
                settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="w-10 h-10 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold">
                      {day.day_number}
                    </span>
                    <div>
                      <h4 className={`font-bold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{day.title || `Dia ${day.day_number}`}</h4>
                      <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Sessão {day.day_number}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {day.versiculo && (
                    <div className="p-4 bg-brand-offwhite rounded-2xl italic text-stone-700 border-l-4 border-brand-blue">
                      "{day.versiculo}"
                    </div>
                  )}
                  {day.explicacao && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-brand-blue">Reflexão</h4>
                      <p className={`text-sm leading-relaxed ${settings.theme === 'dark' ? 'text-stone-300' : 'text-stone-600'}`}>{day.explicacao}</p>
                    </div>
                  )}
                  {day.aplicacao && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-brand-sage">Aplicação Prática</h4>
                      <p className={`text-sm leading-relaxed ${settings.theme === 'dark' ? 'text-stone-300' : 'text-stone-600'}`}>{day.aplicacao}</p>
                    </div>
                  )}
                  {day.pergunta && (
                    <div className="p-4 bg-brand-sage/10 rounded-2xl space-y-2">
                      <h4 className="text-xs font-bold uppercase text-brand-sage">Para Refletir</h4>
                      <p className="text-sm italic text-brand-sage">{day.pergunta}</p>
                    </div>
                  )}
                  {day.oracao && (
                    <div className="space-y-2">
                      <h4 className="text-xs font-bold uppercase text-brand-blue">Oração</h4>
                      <p className={`text-sm italic ${settings.theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>"{day.oracao}"</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const categories = Array.from(new Set(studyPlans.map(p => p.category)));

    return (
      <div className="space-y-8 pb-20">
        <header>
          <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Premium</h1>
          <p className="text-stone-500">Conteúdo espiritual aprofundado e prático.</p>
        </header>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Bíblia Digital</SectionHeader>
          <div 
            onClick={() => setActiveTab('bible')}
            className={`p-6 rounded-[32px] border shadow-sm flex items-center justify-between cursor-pointer transition-all hover:scale-[1.01] ${
              settings.theme === 'dark' ? 'bg-brand-blue/10 border-brand-blue/20' : 'bg-brand-blue/5 border-brand-blue/10'
            }`}
          >
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-brand-blue text-white flex items-center justify-center shadow-lg shadow-brand-blue/20">
                <Book size={28} />
              </div>
              <div>
                <h3 className={`text-lg font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Navegar pela Bíblia</h3>
                <p className="text-sm text-stone-500">Todos os livros, capítulos e versículos com texto completo.</p>
              </div>
            </div>
            <ChevronRight size={24} className="text-brand-blue" />
          </div>
        </section>

        <section className="space-y-6">
          <SectionHeader theme={settings.theme}>Aprendendo a Ler a Bíblia</SectionHeader>
          
          <div className={`p-6 rounded-[32px] border shadow-sm space-y-6 ${settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'}`}>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-brand-blue flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-sm">1</span>
                Por Onde Começar a Ler a Bíblia
              </h3>
              <p className="text-sm text-stone-500 leading-relaxed">
                Muitas pessoas abrem a Bíblia e não sabem por onde começar. A Bíblia é uma biblioteca de livros e não precisa ser lida obrigatoriamente do começo ao fim.
              </p>
              <div className="space-y-2 pl-4 border-l-2 border-brand-blue/20">
                {[
                  { t: "Evangelho de Marcos", d: "leitura simples sobre a vida de Jesus." },
                  { t: "Evangelho de João", d: "aprofundamento sobre quem Jesus é." },
                  { t: "Salmos", d: "ajuda na vida emocional e espiritual." },
                  { t: "Provérbios", d: "sabedoria prática para o dia a dia." },
                  { t: "Gênesis", d: "origem da história bíblica." }
                ].map((item, i) => (
                  <div key={i} className="text-sm">
                    <span className="font-bold text-stone-700">{i+1}. {item.t}</span> – {item.d}
                  </div>
                ))}
              </div>
              <div className="p-4 bg-brand-blue/5 rounded-2xl border border-brand-blue/10">
                <p className="text-xs font-bold text-brand-blue uppercase tracking-widest mb-1">Dica Importante</p>
                <p className="text-sm italic text-stone-600">Leia pequenos trechos e reflita sobre o que o texto revela sobre Deus, sobre o ser humano e sobre a vida.</p>
              </div>
            </div>

            <div className="h-px bg-stone-100" />

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-brand-blue flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-sm">2</span>
                5 Princípios Simples para Entender a Bíblia
              </h3>
              <div className="grid gap-4">
                {[
                  { t: "Observe o contexto", d: "Antes de interpretar um versículo, observe o que vem antes e depois." },
                  { t: "O que o texto queria dizer na época?", d: "A Bíblia foi escrita em contextos históricos específicos." },
                  { t: "Procure a mensagem principal", d: "Nem todo detalhe é o foco. Qual é a mensagem central?" },
                  { t: "Relacione com a vida real", d: "A Bíblia foi escrita para transformar a vida." },
                  { t: "Leia com reflexão", d: "Não é apenas informação. É transformação interior." }
                ].map((p, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="text-brand-blue font-bold">{i+1}.</div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-700">{p.t}</h4>
                      <p className="text-xs text-stone-500">{p.d}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-stone-100" />

            <div className="space-y-4">
              <h3 className="text-lg font-bold text-brand-blue flex items-center gap-2">
                <span className="w-8 h-8 rounded-full bg-brand-blue/10 flex items-center justify-center text-sm">3</span>
                Método Simples de Leitura Bíblica (3 Perguntas)
              </h3>
              <p className="text-sm text-stone-500">Sempre que ler um trecho da Bíblia, faça três perguntas:</p>
              <div className="space-y-3">
                {[
                  "O que esse texto revela sobre Deus?",
                  "O que esse texto revela sobre o ser humano?",
                  "O que posso aplicar hoje na minha vida?"
                ].map((q, i) => (
                  <div key={i} className="p-4 bg-brand-sage/5 rounded-2xl border border-brand-sage/10 flex items-center gap-3">
                    <CheckCircle2 size={18} className="text-brand-sage" />
                    <p className="text-sm font-medium text-stone-700">{q}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-stone-400 italic text-center">Esse método ajuda qualquer pessoa a ler a Bíblia de forma prática.</p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Tenho uma dúvida bíblica</SectionHeader>
          <div className={`p-6 rounded-[32px] border shadow-sm space-y-4 ${settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'}`}>
            <p className="text-sm text-stone-500 leading-relaxed">
              Muitas pessoas têm dúvidas quando leem a Bíblia. Nem sempre é fácil entender alguns textos ou saber como aplicar certos ensinamentos na vida.
            </p>
            <textarea 
              placeholder="Escreva aqui sua dúvida ou pergunta..."
              className={`w-full p-4 rounded-2xl border focus:ring-2 focus:ring-brand-blue outline-none transition-all min-h-[100px] resize-none ${
                settings.theme === 'dark' ? 'bg-white/5 border-white/10 text-dark-text' : 'bg-stone-50 border-brand-gray text-stone-800'
              }`}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  const val = (e.target as HTMLTextAreaElement).value;
                  if (val.trim()) {
                    askCounselor(val, 'doubt');
                    (e.target as HTMLTextAreaElement).value = '';
                  }
                }
              }}
            />
            <p className="text-[10px] text-stone-400 text-center italic">Pressione Enter para enviar sua dúvida</p>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Estudo Bíblico Guiado</SectionHeader>
          <div className={`p-6 rounded-[32px] border shadow-sm space-y-6 ${settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'}`}>
            <div className="space-y-3">
              <p className="text-sm text-stone-600 leading-relaxed">
                Se você deseja compreender melhor a Bíblia, aprender a interpretar os textos e aprofundar sua fé, você pode participar de encontros de estudo bíblico guiado.
              </p>
              <ul className="space-y-2">
                {[
                  "entender melhor a Bíblia",
                  "tirar dúvidas sobre textos difíceis",
                  "aprender princípios de interpretação bíblica",
                  "aplicar os ensinamentos na vida real"
                ].map((item, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-stone-500">
                    <div className="w-1.5 h-1.5 rounded-full bg-brand-blue" />
                    {item}
                  </li>
                ))}
              </ul>
              <p className="text-sm text-stone-600">
                Os estudos podem ser individuais ou em pequenos grupos e acontecem de forma online.
              </p>
            </div>
            <a 
              href="https://wa.me/5511969521259?text=Olá! Eu encontrei o app Bíblia na Vida Real e gostaria de saber mais sobre o estudo bíblico guiado."
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 hover:scale-[1.02] transition-transform"
            >
              <MessageCircle size={20} /> Quero aprofundar meu estudo bíblico
            </a>
          </div>
        </section>

        {categories.map(cat => (
          <section key={cat} className="space-y-4">
            <SectionHeader theme={settings.theme}>{cat}</SectionHeader>
            <div className="grid grid-cols-1 gap-4">
              {studyPlans.filter(p => p.category === cat).map(plan => (
                <motion.div 
                  key={plan.id}
                  whileTap={{ scale: 0.98 }}
                  onClick={async () => {
                    try {
                      const snapshot = await getDocs(collection(db, 'study_plans', plan.id as any, 'days'));
                      const days = snapshot.docs.map(doc => doc.data());
                      setSelectedPlanDays(days as any);
                      setSelectedPlan(plan);
                      setView('plan-detail');
                    } catch (e) {
                      console.error(e);
                    }
                  }}
                  className={`p-5 rounded-3xl border shadow-sm flex items-center justify-between cursor-pointer transition-colors ${
                    settings.theme === 'dark' ? 'bg-dark-card border-white/5 hover:bg-white/5' : 'bg-white border-brand-gray hover:bg-stone-50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${settings.theme === 'dark' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-brand-blue/10 text-brand-blue'}`}>
                      <Star size={18} />
                    </div>
                    <div>
                      <h3 className={`font-semibold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{plan.title}</h3>
                      <p className="text-[10px] text-stone-500">{plan.duration_days} dias • {plan.description}</p>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-stone-300" />
                </motion.div>
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  };

  const fetchBibleText = async (book: string, chapter: number) => {
    setIsLoading(true);
    setErrorMessage(null);
    setBibleBook(book);
    setBibleChapter(chapter);
    try {
      const ai = new GoogleGenAI({ apiKey: (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '') || '' });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Forneça o texto completo do capítulo ${chapter} do livro de ${book} na versão NVI (Nova Versão Internacional) em Português.
        Formate a resposta como um JSON com um array de objetos, onde cada objeto tem 'verse' (número do versículo) e 'text' (texto do versículo).`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                verse: { type: Type.NUMBER },
                text: { type: Type.STRING }
              },
              required: ["verse", "text"]
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setBibleContent(data);
      setView('bible-reader');
    } catch (e) {
      console.error(e);
      setErrorMessage("Desculpe, não conseguimos carregar o texto bíblico agora.");
    } finally {
      setIsLoading(false);
    }
  };

  const renderBible = () => {
    const books = [
      "Gênesis", "Êxodo", "Levítico", "Números", "Deuteronômio", "Josué", "Juízes", "Rute", "1 Samuel", "2 Samuel", "1 Reis", "2 Reis", "1 Crônicas", "2 Crônicas", "Esdras", "Neemias", "Ester", "Jó", "Salmos", "Provérbios", "Eclesiastes", "Cânticos", "Isaías", "Jeremias", "Lamentações", "Ezequiel", "Daniel", "Oseias", "Joel", "Amós", "Obadias", "Jonas", "Miqueias", "Naum", "Habacuque", "Sofonias", "Ageu", "Zacarias", "Malaquias", "Mateus", "Marcos", "Lucas", "João", "Atos", "Romanos", "1 Coríntios", "2 Coríntios", "Gálatas", "Efésios", "Filipenses", "Colossenses", "1 Tessalonicenses", "2 Tessalonicenses", "1 Timóteo", "2 Timóteo", "Tito", "Filemom", "Hebreus", "Tiago", "1 Pedro", "2 Pedro", "1 João", "2 João", "3 João", "Judas", "Apocalipse"
    ];

    if (view === 'bible-reader' && bibleContent) {
      return (
        <div className="space-y-6 pb-20">
          <header className="flex items-center gap-4">
            <button onClick={() => setView('main')} className={`p-2 -ml-2 ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-600'}`}>
              <ArrowLeft size={24} />
            </button>
            <h1 className={`text-2xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Leitura Bíblica</h1>
          </header>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-8 rounded-[40px] border shadow-sm space-y-6 font-serif leading-relaxed ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-800'
            }`}
          >
            <div className="flex justify-between items-center">
              <div className="flex gap-2">
                <span className="px-3 py-1 bg-brand-blue/10 text-brand-blue text-[10px] font-bold rounded-full uppercase tracking-widest">
                  {bibleContent.book}
                </span>
                <span className="px-3 py-1 bg-brand-sage/20 text-brand-sage text-[10px] font-bold rounded-full uppercase tracking-widest">
                  Capítulo {bibleContent.chapter}
                </span>
              </div>
              <div className="flex gap-2">
                <Volume2 size={18} className="text-stone-300 cursor-pointer hover:text-brand-blue transition-colors" />
                <Share2 size={18} className="text-stone-300 cursor-pointer hover:text-brand-blue transition-colors" />
              </div>
            </div>
            
            <div className="text-center space-y-2">
              <h2 className="text-3xl font-bold">{bibleContent.book} {bibleContent.chapter}</h2>
              <div className="w-12 h-1 bg-brand-blue/20 mx-auto rounded-full" />
            </div>

            <div className="space-y-6 text-lg">
              {bibleContent.verses?.map((v: any) => (
                <div key={v.number} className="flex gap-4 group">
                  <span className="text-brand-blue font-bold text-xs mt-1.5 opacity-50 group-hover:opacity-100 transition-opacity min-w-[20px]">
                    {v.number}
                  </span>
                  <p className="flex-1">
                    {v.text}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-8 border-t border-stone-100 flex justify-between items-center">
              <button 
                onClick={() => fetchBibleText(bibleContent.book, bibleContent.chapter - 1)}
                disabled={bibleContent.chapter <= 1 || isLoading}
                className="p-3 rounded-xl bg-stone-100 text-stone-600 disabled:opacity-30"
              >
                <ArrowLeft size={20} />
              </button>
              <span className="text-xs font-bold text-stone-400 uppercase tracking-widest">
                Capítulo {bibleContent.chapter}
              </span>
              <button 
                onClick={() => fetchBibleText(bibleContent.book, bibleContent.chapter + 1)}
                disabled={isLoading}
                className="p-3 rounded-xl bg-stone-100 text-stone-600"
              >
                <ChevronRight size={20} />
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="space-y-6 pb-20">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('main')} className={`p-2 -ml-2 ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-600'}`}>
              <ArrowLeft size={24} />
            </button>
            <h1 className={`text-2xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Bíblia Digital</h1>
          </div>
        </header>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Livro</label>
            <select 
              value={bibleBook}
              onChange={(e) => setBibleBook(e.target.value)}
              className={`w-full p-3 rounded-xl border ${settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-700'}`}
            >
              {books.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-stone-400 uppercase tracking-widest">Capítulo</label>
            <input 
              type="number" 
              min="1"
              value={bibleChapter}
              onChange={(e) => setBibleChapter(parseInt(e.target.value) || 1)}
              className={`w-full p-3 rounded-xl border ${settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-700'}`}
            />
          </div>
        </div>

        <button 
          onClick={() => fetchBibleText(bibleBook, bibleChapter)}
          disabled={isLoading}
          className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Book size={18} /> Ler Capítulo</>}
        </button>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Como Começar a Ler a Bíblia</SectionHeader>
          <div className={`p-6 rounded-[32px] border shadow-sm space-y-6 ${
            settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
          }`}>
            <p className="text-sm text-stone-500 leading-relaxed">
              Muitas pessoas querem ler a Bíblia, mas não sabem por onde começar.
            </p>
            
            <div className="space-y-4">
              <p className="text-sm font-bold text-brand-blue">Aqui estão algumas sugestões simples para iniciar sua jornada:</p>
              
              <div className="space-y-4">
                <div className="flex gap-3">
                  <span className="text-xl">1️⃣</span>
                  <div>
                    <h4 className={`font-bold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Comece pelos Evangelhos</h4>
                    <p className="text-xs text-stone-500">Os Evangelhos (Mateus, Marcos, Lucas e João) apresentam a vida e os ensinamentos de Jesus.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="text-xl">2️⃣</span>
                  <div>
                    <h4 className={`font-bold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Leia pequenos trechos por dia</h4>
                    <p className="text-xs text-stone-500">Não é necessário ler muitos capítulos. Às vezes alguns versículos já trazem uma reflexão profunda.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="text-xl">3️⃣</span>
                  <div>
                    <h4 className={`font-bold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Pergunte: o que esse texto diz sobre a vida?</h4>
                    <p className="text-xs text-stone-500">A Bíblia não é apenas um livro antigo, mas uma fonte de sabedoria para o dia a dia.</p>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <span className="text-xl">4️⃣</span>
                  <div>
                    <h4 className={`font-bold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Reflita e aplique</h4>
                    <p className="text-xs text-stone-500">Mais importante que ler muito é permitir que o texto transforme sua forma de pensar e viver.</p>
                  </div>
                </div>
              </div>
            </div>

            <button 
              onClick={() => { setActiveTab('counselor'); setView('main'); }}
              className="w-full py-4 bg-brand-blue/10 text-brand-blue rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-brand-blue/20 transition-all"
            >
              <MessageCircle size={18} /> Tenho uma dúvida bíblica
            </button>
          </div>
        </section>
      </div>
    );
  };

  const renderCounselor = () => (
    <div className="space-y-6 pb-20">
      <header className="space-y-2">
        <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Conselheiro</h1>
        <p className="text-stone-500">Pergunte algo sobre sua vida e receba uma orientação bíblica.</p>
      </header>

      <div className={`p-6 rounded-[32px] border shadow-sm space-y-4 ${
        settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
      }`}>
        <textarea 
          placeholder="Ex: Estou com ansiedade, problemas familiares, medo do futuro..."
          value={counselorQuestion}
          onChange={(e) => setCounselorQuestion(e.target.value)}
          className={`w-full min-h-[100px] bg-transparent border-none outline-none resize-none text-lg font-serif ${
            settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-700'
          }`}
        />
        <button 
          onClick={() => { if (counselorQuestion.trim()) askCounselor(counselorQuestion); }}
          disabled={isLoading || !counselorQuestion.trim()}
          className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-brand-blue/20 disabled:opacity-50"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : <><Sparkles size={18} /> Perguntar</>}
        </button>
      </div>

      {counselorResponse && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          <section className="space-y-3">
            <SectionHeader theme={settings.theme}>{counselorResponse.type === 'doubt' ? 'Resposta à sua Dúvida' : 'Reflexão Espiritual'}</SectionHeader>
            <div className={`p-6 rounded-3xl border shadow-sm leading-relaxed ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-700'
            }`}>
              {counselorResponse.reflexao}
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader theme={settings.theme}>Palavra de Deus</SectionHeader>
            <div className="p-6 bg-brand-blue text-white rounded-3xl shadow-lg shadow-brand-blue/20 italic">
              "{counselorResponse.versiculo}"
            </div>
          </section>

          {counselorResponse.type === 'doubt' && (
            <div className="p-6 bg-brand-sage/10 rounded-3xl border border-brand-sage/20 space-y-4">
              <p className="text-sm text-brand-sage font-medium text-center">
                Se você deseja estudar a Bíblia com mais profundidade, também pode participar de um estudo bíblico guiado.
              </p>
              <a 
                href="https://wa.me/5511969521259?text=Olá! Eu uso o app Bíblia na Vida Real e gostaria de saber mais sobre estudo bíblico guiado."
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-3 bg-brand-sage text-white rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-md shadow-brand-sage/20"
              >
                <MessageCircle size={18} /> Quero aprofundar meu estudo bíblico
              </a>
            </div>
          )}

          <section className="space-y-3">
            <SectionHeader theme={settings.theme}>Orientação Prática</SectionHeader>
            <div className={`p-6 rounded-3xl border leading-relaxed flex gap-4 ${
              settings.theme === 'dark' ? 'bg-brand-sage/10 border-brand-sage/20 text-dark-text' : 'bg-brand-sage/5 border-brand-sage/10 text-stone-700'
            }`}>
              <div className="w-8 h-8 rounded-full bg-brand-sage text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">!</div>
              <p>{counselorResponse.orientacao}</p>
            </div>
          </section>

          <section className="space-y-3">
            <SectionHeader theme={settings.theme}>Oração</SectionHeader>
            <div className={`p-6 rounded-3xl border italic ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-stone-400' : 'bg-white border-brand-gray text-stone-500'
            }`}>
              "{counselorResponse.oracao}"
            </div>
          </section>
          
          <button 
            onClick={() => { setCounselorResponse(null); setCounselorQuestion(''); }}
            className="w-full py-3 text-stone-400 text-sm font-bold uppercase tracking-widest"
          >
            Nova Pergunta
          </button>
        </motion.div>
      )}
    </div>
  );

  const renderAdmin = () => {
    if (user?.role !== 'admin') return null;

    return (
      <div className="space-y-8 pb-20">
        <header className="flex items-center justify-between">
          <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Admin</h1>
          <button onClick={() => setActiveTab('config')} className="text-stone-400"><ArrowLeft /></button>
        </header>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Usuários Cadastrados ({allUsers.length})</SectionHeader>
          <div className={`rounded-3xl border overflow-hidden divide-y ${
            settings.theme === 'dark' ? 'bg-dark-card border-white/5 divide-white/5' : 'bg-white border-brand-gray divide-brand-gray'
          }`}>
            {allUsers.map(u => (
              <div key={u.id} className="p-4 flex items-center justify-between">
                <div>
                  <p className={`font-bold text-sm ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{u.name}</p>
                  <p className="text-[10px] text-stone-500">{u.email} • {u.role}</p>
                </div>
                <span className="text-[10px] text-stone-400">{new Date(u.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Gerenciar Conteúdo</SectionHeader>
          <div className="grid grid-cols-1 gap-4">
            <button className={`p-6 rounded-3xl border text-center space-y-2 ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
            }`}>
              <div className="w-10 h-10 bg-brand-blue/10 text-brand-blue rounded-full flex items-center justify-center mx-auto">
                <Plus size={20} />
              </div>
              <p className="text-xs font-bold">Novo Tema</p>
            </button>
          </div>
        </section>
      </div>
    );
  };

  const renderHome = () => (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className={`text-2xl font-sans font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Bíblia na Vida Real</h1>
          <p className={`text-sm italic ${settings.theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>Seu guia diário de fé</p>
        </div>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${settings.theme === 'dark' ? 'bg-dark-card text-brand-blue' : 'bg-brand-blue/10 text-brand-blue'}`}>
          <BookOpen size={20} />
        </div>
      </header>

      <form onSubmit={handleSearch} className="relative flex gap-2">
        <div className="relative flex-1">
          <input 
            type="text" 
            placeholder="Digite Como você se sente hoje..."
            className={`w-full pl-12 pr-4 py-4 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-blue/50 transition-all ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-800'
            }`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400" size={20} />
        </div>
        <button 
          type="submit"
          disabled={isLoading || !searchQuery.trim()}
          className="px-6 bg-brand-blue text-white rounded-2xl font-bold hover:bg-brand-blue/90 disabled:opacity-50 transition-all flex items-center justify-center shadow-md shadow-brand-blue/20"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : "Buscar"}
        </button>
      </form>

      {errorMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-sm flex items-center gap-2"
        >
          <div className="w-2 h-2 rounded-full bg-red-500" />
          {errorMessage}
        </motion.div>
      )}

      <div className="space-y-4">
        <SectionHeader theme={settings.theme}>Destaques</SectionHeader>
        
        <div className="grid grid-cols-1 gap-4">
          <motion.div 
            whileTap={{ scale: 0.98 }}
            onClick={() => { setSelectedTopic(verseOfTheDay); setView('results'); }}
            className="bg-brand-blue text-white p-6 rounded-3xl shadow-lg shadow-brand-blue/20 cursor-pointer relative overflow-hidden group"
          >
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Sparkles size={80} />
            </div>
            <span className="text-xs font-medium uppercase tracking-wider opacity-60">Versículo do Dia</span>
            <h3 className="text-xl font-serif mt-2 leading-relaxed">"{verseOfTheDay?.versiculo}"</h3>
            <p className="mt-4 text-sm opacity-80 line-clamp-2">{verseOfTheDay?.explicacao}</p>
          </motion.div>

          <div className="grid grid-cols-2 gap-4">
            <motion.div 
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('premium')}
              className={`p-5 rounded-3xl border shadow-sm cursor-pointer flex flex-col justify-between gap-4 ${
                settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-blue/10 text-brand-blue flex items-center justify-center">
                <MessageCircle size={20} />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Dúvida Bíblica</h3>
                <p className="text-[10px] text-stone-500">Pergunte à IA</p>
              </div>
            </motion.div>

            <motion.div 
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab('premium')}
              className={`p-5 rounded-3xl border shadow-sm cursor-pointer flex flex-col justify-between gap-4 ${
                settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
              }`}
            >
              <div className="w-10 h-10 rounded-2xl bg-brand-sage/20 text-brand-sage flex items-center justify-center">
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className={`text-sm font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Estudo Guiado</h3>
                <p className="text-[10px] text-stone-500">Aprofunde sua fé</p>
              </div>
            </motion.div>
          </div>
        </div>

        <motion.div 
          whileTap={{ scale: 0.98 }}
          onClick={() => { setSelectedTopic(topicInFocus); setView('results'); }}
          className={`p-6 rounded-3xl shadow-sm cursor-pointer flex justify-between items-center border ${
            settings.theme === 'dark' ? 'bg-brand-sage/20 border-brand-sage/30' : 'bg-brand-sage/10 border-brand-sage/20'
          }`}
        >
          <div>
            <span className={`text-xs font-medium uppercase tracking-wider ${settings.theme === 'dark' ? 'text-brand-sage' : 'text-brand-sage'}`}>Tema em Foco</span>
            <h3 className={`text-lg font-semibold mt-1 ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{topicInFocus?.tema}</h3>
            <p className={`text-sm mt-1 ${settings.theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>{topicInFocus?.versiculo}</p>
          </div>
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.theme === 'dark' ? 'bg-dark-card text-brand-sage' : 'bg-white text-brand-sage'}`}>
            <ChevronRight size={24} />
          </div>
        </motion.div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <SectionHeader theme={settings.theme}>Temas Populares</SectionHeader>
          <button onClick={() => setActiveTab('temas')} className={`text-xs font-semibold hover:underline ${settings.theme === 'dark' ? 'text-brand-blue' : 'text-brand-blue'}`}>Ver todos</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {INITIAL_TOPICS.slice(0, 4).map((topic, i) => (
            <motion.div 
              key={i}
              whileTap={{ scale: 0.95 }}
              onClick={() => { setSelectedTopic(topic); setView('results'); }}
              className={`p-4 rounded-2xl border cursor-pointer transition-colors ${
                settings.theme === 'dark' ? 'bg-dark-card border-white/5 hover:bg-white/5' : 'bg-white border-brand-gray hover:bg-stone-50'
              }`}
            >
              <h4 className={`font-medium ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{topic.tema}</h4>
              <p className="text-xs text-stone-500 mt-1">{topic.tags[0]}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderResults = () => {
    if (!selectedTopic) return null;
    const isFav = favorites.some(f => f.content_id === selectedTopic.id && f.type === 'topic');

    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('main')} className={`p-2 -ml-2 ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-600'}`}>
            <ArrowLeft size={24} />
          </button>
          <div className="flex gap-2">
            <button 
              onClick={() => toggleFavorite(selectedTopic)}
              className={`p-2 rounded-full transition-colors ${isFav ? 'bg-brand-blue text-white' : (settings.theme === 'dark' ? 'bg-dark-card text-stone-400' : 'bg-white border border-brand-gray text-stone-400')}`}
            >
              {isFav ? <BookmarkCheck size={20} /> : <Bookmark size={20} />}
            </button>
            <button className={`p-2 rounded-full ${settings.theme === 'dark' ? 'bg-dark-card text-stone-400' : 'bg-white border border-brand-gray text-stone-400'}`}>
              <Share2 size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <h1 className={`text-3xl font-sans font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{selectedTopic.tema}</h1>
          <p className={`text-lg italic ${settings.theme === 'dark' ? 'text-stone-400' : 'text-stone-500'}`}>{selectedTopic.versiculo}</p>
          {selectedTopic.is_ai_generated && (
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-tighter ${settings.theme === 'dark' ? 'bg-brand-blue/20 text-brand-blue' : 'bg-brand-blue/10 text-brand-blue'}`}>
              <Sparkles size={10} /> Gerado por IA
            </div>
          )}
        </div>

        <div className="space-y-8">
          <section className="space-y-3">
            <SectionHeader theme={settings.theme}>Explicação Simples</SectionHeader>
            <div className={`p-6 rounded-3xl border shadow-sm leading-relaxed ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-700'
            }`}>
              {selectedTopic.explicacao}
            </div>
          </section>

          {selectedTopic.contexto && (
            <section className="space-y-3">
              <SectionHeader theme={settings.theme}>Contexto Histórico</SectionHeader>
              <p className={`leading-relaxed italic border-l-2 pl-4 ${settings.theme === 'dark' ? 'text-stone-400 border-brand-blue/30' : 'text-stone-600 border-brand-blue/20'}`}>
                {selectedTopic.contexto}
              </p>
            </section>
          )}

          <section className="space-y-3">
            <SectionHeader theme={settings.theme}>Aplicação Prática</SectionHeader>
            <div className={`p-6 rounded-3xl border leading-relaxed flex gap-4 ${
              settings.theme === 'dark' ? 'bg-brand-sage/10 border-brand-sage/20 text-dark-text' : 'bg-brand-sage/5 border-brand-sage/10 text-stone-700'
            }`}>
              <div className="w-8 h-8 rounded-full bg-brand-sage text-white flex-shrink-0 flex items-center justify-center text-xs font-bold">!</div>
              <p>{selectedTopic.aplicacao}</p>
            </div>
          </section>

          {selectedTopic.perguntas && selectedTopic.perguntas.length > 0 && (
            <section className="space-y-3">
              <SectionHeader theme={settings.theme}>Para Refletir</SectionHeader>
              <ul className="space-y-3">
                {selectedTopic.perguntas.map((q, i) => (
                  <li key={i} className="flex gap-3">
                    <span className={`font-serif text-xl ${settings.theme === 'dark' ? 'text-brand-blue/50' : 'text-brand-blue/30'}`}>0{i+1}</span>
                    <p className={`pt-1 ${settings.theme === 'dark' ? 'text-stone-400' : 'text-stone-600'}`}>{q}</p>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => setView('devotional')}
            className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold shadow-lg shadow-brand-blue/20 flex items-center justify-center gap-2"
          >
            Ver Devocional Relacionado
            <ChevronRight size={18} />
          </motion.button>
        </div>
      </div>
    );
  };

  const renderDevotional = () => {
    if (!selectedTopic) return null;
    const isRead = readDevotionals.includes(selectedTopic.id!);

    return (
      <div className="space-y-6 pb-20">
        <div className="flex items-center justify-between">
          <button onClick={() => setView('results')} className={`p-2 -ml-2 ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-600'}`}>
            <ArrowLeft size={24} />
          </button>
          <button className={`p-2 rounded-full ${settings.theme === 'dark' ? 'bg-dark-card text-stone-400' : 'bg-white border border-brand-gray text-stone-400'}`}>
            <Share2 size={20} />
          </button>
        </div>

        <div className="space-y-2">
          <SectionHeader theme={settings.theme}>Devocional Diário</SectionHeader>
          <h1 className={`text-3xl font-sans font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{selectedTopic.tema}</h1>
        </div>

        <div className="prose prose-stone max-w-none">
          <div className={`p-8 rounded-[40px] border shadow-sm leading-relaxed text-lg font-serif ${
            settings.theme === 'dark' ? 'bg-dark-card border-white/5 text-dark-text' : 'bg-white border-brand-gray text-stone-700'
          }`}>
            {selectedTopic.devocional}
          </div>
        </div>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Oração Modelo</SectionHeader>
          <div className="bg-brand-blue text-white p-6 rounded-3xl relative overflow-hidden shadow-lg shadow-brand-blue/20">
            <div className="absolute top-0 right-0 p-4 opacity-10">
              <Volume2 size={40} />
            </div>
            <p className="italic leading-relaxed">"{selectedTopic.oracao}"</p>
            <button className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest opacity-70 hover:opacity-100 transition-opacity">
              <Volume2 size={14} /> Ouvir Oração
            </button>
          </div>
        </section>

        <div className="pt-4">
          <motion.button 
            whileTap={{ scale: 0.98 }}
            onClick={() => markAsRead(selectedTopic.id!)}
            className={`w-full py-4 rounded-2xl font-bold flex items-center justify-center gap-2 transition-all ${
              isRead 
              ? 'bg-brand-sage/20 text-brand-sage border border-brand-sage/30' 
              : (settings.theme === 'dark' ? 'bg-white/5 text-dark-text hover:bg-white/10' : 'bg-white border border-brand-gray text-stone-800 hover:bg-stone-50')
            }`}
          >
            {isRead ? (
              <>
                <CheckCircle2 size={18} />
                Lido com Sucesso
              </>
            ) : (
              'Marcar como Lido'
            )}
          </motion.button>
        </div>
      </div>
    );
  };

  const renderFavorites = () => (
    <div className="space-y-6 pb-20">
      <h1 className={`text-3xl font-sans font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Favoritos</h1>
      
      {favorites.length === 0 ? (
        <div className="py-20 text-center space-y-4">
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${settings.theme === 'dark' ? 'bg-dark-card text-stone-700' : 'bg-white border border-brand-gray text-stone-200'}`}>
            <Heart size={32} />
          </div>
          <p className="text-stone-400 italic">Você ainda não salvou nada.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {favorites.map((fav) => (
            <motion.div 
              key={fav.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={() => {
                const topic = topics.find(t => t.id === fav.content_id);
                if (topic) { setSelectedTopic(topic); setView('results'); }
              }}
              className={`p-5 rounded-3xl border shadow-sm flex justify-between items-center cursor-pointer transition-colors ${
                settings.theme === 'dark' ? 'bg-dark-card border-white/5 hover:bg-white/5' : 'bg-white border-brand-gray hover:bg-stone-50'
              }`}
            >
              <div>
                <h3 className={`font-semibold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{fav.title}</h3>
                <p className="text-sm text-stone-500 italic">{fav.subtitle}</p>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  if (user) {
                    deleteDoc(doc(db, 'users', user.id as any, 'favorites', fav.id as any));
                  }
                }}
                className="text-brand-blue hover:scale-110 transition-transform"
              >
                <Heart size={20} fill="currentColor" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );

  const renderTopics = () => (
    <div className="space-y-6 pb-20">
      <h1 className={`text-3xl font-sans font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Temas</h1>
      <div className="grid grid-cols-1 gap-4">
        {topics.map((topic, i) => (
          <motion.div 
            key={i}
            whileTap={{ scale: 0.98 }}
            onClick={() => { setSelectedTopic(topic); setView('results'); }}
            className={`p-6 rounded-3xl border shadow-sm flex items-center justify-between cursor-pointer transition-colors ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5 hover:bg-white/5' : 'bg-white border-brand-gray hover:bg-stone-50'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${settings.theme === 'dark' ? 'bg-white/5 text-brand-blue' : 'bg-brand-blue/10 text-brand-blue'}`}>
                <BookOpen size={20} />
              </div>
              <div>
                <h3 className={`font-semibold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{topic.tema}</h3>
                <p className="text-sm text-stone-500">{topic.tags.join(', ')}</p>
              </div>
            </div>
            <ChevronRight size={20} className="text-stone-300" />
          </motion.div>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="space-y-8 pb-20">
      <h1 className={`text-3xl font-sans font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Configurações</h1>
      
      <div className="space-y-6">
        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Preferências</SectionHeader>
          <div className={`rounded-3xl border overflow-hidden divide-y ${
            settings.theme === 'dark' ? 'bg-dark-card border-white/5 divide-white/5' : 'bg-white border-brand-gray divide-brand-gray'
          }`}>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h4 className={`font-medium ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Linguagem</h4>
                <p className="text-xs text-stone-500">Nível de profundidade dos textos</p>
              </div>
              <select 
                value={settings.language}
                onChange={(e) => setSettings({...settings, language: e.target.value as any})}
                className={`border-none rounded-lg text-sm font-bold p-2 focus:ring-0 ${
                  settings.theme === 'dark' ? 'bg-white/5 text-dark-text' : 'bg-brand-offwhite text-stone-800'
                }`}
              >
                <option value="simple">Simples</option>
                <option value="intermediate">Intermediária</option>
              </select>
            </div>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h4 className={`font-medium ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Notificações</h4>
                <p className="text-xs text-stone-500">Versículo do dia e lembretes</p>
              </div>
              <button 
                onClick={() => setSettings({...settings, notifications: !settings.notifications})}
                className={`w-12 h-6 rounded-full transition-colors relative ${settings.notifications ? 'bg-brand-blue' : 'bg-stone-200'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${settings.notifications ? 'left-7' : 'left-1'}`} />
              </button>
            </div>
            <div className="p-5 flex items-center justify-between">
              <div>
                <h4 className={`font-medium ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Tema</h4>
                <p className="text-xs text-stone-500">Aparência do aplicativo</p>
              </div>
              <div className={`flex p-1 rounded-xl ${settings.theme === 'dark' ? 'bg-white/5' : 'bg-brand-offwhite'}`}>
                <button 
                  onClick={() => setSettings({...settings, theme: 'light'})}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.theme === 'light' ? 'bg-white shadow-sm text-brand-blue' : 'text-stone-400'}`}
                >
                  Claro
                </button>
                <button 
                  onClick={() => setSettings({...settings, theme: 'dark'})}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${settings.theme === 'dark' ? 'bg-brand-blue shadow-sm text-white' : 'text-stone-400'}`}
                >
                  Escuro
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <SectionHeader theme={settings.theme}>Conta</SectionHeader>
          <div className={`rounded-3xl border overflow-hidden ${
            settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
          }`}>
            {user ? (
              <div className="p-5 space-y-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-brand-blue text-white flex items-center justify-center font-bold text-xl">
                    {user.name[0]}
                  </div>
                  <div>
                    <h4 className={`font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>{user.name}</h4>
                    <p className="text-xs text-stone-500">{user.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 bg-brand-sage/20 text-brand-sage text-[10px] font-bold rounded-full uppercase">
                      {user.role}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={handleLogout}
                  className="w-full py-3 bg-red-500/10 text-red-500 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
                >
                  <LogOut size={16} /> Sair da Conta
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setView('login')}
                className={`w-full p-5 text-left flex items-center justify-between transition-colors ${settings.theme === 'dark' ? 'hover:bg-white/5' : 'hover:bg-stone-50'}`}
              >
                <span className={`font-medium ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Entrar ou Criar Conta</span>
                <ChevronRight size={18} className="text-stone-300" />
              </button>
            )}
          </div>
        </section>

        {user?.role === 'admin' && (
          <section className="space-y-4">
            <SectionHeader theme={settings.theme}>Administração</SectionHeader>
            <button 
              onClick={() => { setActiveTab('admin'); setView('main'); }}
              className={`w-full p-5 rounded-3xl border flex items-center justify-between transition-colors ${
                settings.theme === 'dark' ? 'bg-dark-card border-white/5 hover:bg-white/5' : 'bg-white border-brand-gray hover:bg-stone-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <Shield size={20} className="text-brand-blue" />
                <span className={`font-medium ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Painel do Administrador</span>
              </div>
              <ChevronRight size={18} className="text-stone-300" />
            </button>
          </section>
        )}

        <div className="text-center pt-8">
          <p className="text-[10px] text-stone-400 uppercase tracking-widest font-bold">Bíblia Simples v1.0.0</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen ${settings.theme === 'dark' ? 'bg-dark-bg text-dark-text' : 'bg-brand-offwhite text-stone-800'} font-sans selection:bg-brand-blue/20`}>
      <div className="max-w-md mx-auto px-6 pt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={view === 'main' ? activeTab : view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {view === 'results' ? renderResults() : 
             view === 'devotional' ? renderDevotional() :
             view === 'login' ? <LoginView handleLogin={handleLogin} isLoading={isLoading} settings={settings} setView={setView} /> :
             view === 'register' ? <RegisterView handleLogin={handleLogin} isLoading={isLoading} settings={settings} setView={setView} /> :
             view === 'plan-detail' ? renderPremium() :
             view === 'bible-reader' ? renderBible() :
             activeTab === 'home' ? renderHome() :
             activeTab === 'temas' ? renderTopics() :
             activeTab === 'favoritos' ? renderFavorites() :
             activeTab === 'counselor' ? renderCounselor() :
             activeTab === 'bible' ? renderBible() :
             activeTab === 'journal' ? <JournalView user={user} settings={settings} setView={setView} addJournalEntry={addJournalEntry} journalEntries={journalEntries} deleteJournalEntry={deleteJournalEntry} /> :
             activeTab === 'premium' ? renderPremium() :
             activeTab === 'admin' ? renderAdmin() :
             renderSettings()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      <nav className={`fixed bottom-0 left-0 right-0 ${settings.theme === 'dark' ? 'bg-dark-card/80 border-white/5' : 'bg-white/80 border-brand-gray'} backdrop-blur-xl border-t px-6 py-4 flex justify-between items-center z-50`}>
        {[
          { id: 'home', icon: Home, label: 'Home' },
          { id: 'temas', icon: BookOpen, label: 'Temas' },
          { id: 'counselor', icon: MessageCircle, label: 'Ajuda' },
          { id: 'journal', icon: PenTool, label: 'Diário' },
          { id: 'premium', icon: Star, label: 'Premium' },
          { id: 'config', icon: Settings, label: 'Config' }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id as any); setView('main'); }}
            className={`flex flex-col items-center gap-1 transition-all ${activeTab === item.id ? 'text-brand-blue' : 'text-stone-400'}`}
          >
            <item.icon size={22} strokeWidth={activeTab === item.id ? 2.5 : 2} />
            <span className="text-[10px] font-bold uppercase tracking-tighter">{item.label}</span>
            {activeTab === item.id && (
              <motion.div layoutId="nav-indicator" className="w-1 h-1 rounded-full bg-brand-blue mt-0.5" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

// Helper components for the updated design
const SectionHeader = ({ children, theme }: { children: React.ReactNode, theme: 'light' | 'dark' }) => (
  <h2 className={`text-xs uppercase tracking-widest font-bold ${theme === 'dark' ? 'text-stone-500' : 'text-stone-400'}`}>
    {children}
  </h2>
);

const LoginView = ({ handleLogin, isLoading, settings, setView }: any) => {
  return (
    <div className="space-y-8 py-10">
      <div className="text-center space-y-2">
        <div className="w-16 h-16 bg-brand-blue/10 text-brand-blue rounded-3xl flex items-center justify-center mx-auto mb-4">
          <Lock size={32} />
        </div>
        <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Bem-vindo</h1>
        <p className="text-stone-500">Entre para salvar seu progresso espiritual</p>
      </div>

      <div className="space-y-4">
        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold shadow-lg shadow-brand-blue/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Entrar com Google
            </>
          )}
        </button>
      </div>

      <div className="text-center space-y-4">
        <button onClick={() => setView('main')} className="text-stone-400 text-sm">Continuar como visitante</button>
      </div>
    </div>
  );
};

const RegisterView = ({ handleLogin, isLoading, settings, setView }: any) => {
  return (
    <div className="space-y-8 py-10">
      <div className="text-center space-y-2">
        <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Criar Conta</h1>
        <p className="text-stone-500">Inicie sua jornada personalizada</p>
      </div>

      <div className="space-y-4">
        <button 
          onClick={handleLogin}
          disabled={isLoading}
          className="w-full py-4 bg-brand-blue text-white rounded-2xl font-bold shadow-lg shadow-brand-blue/20 flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
        >
          {isLoading ? <Loader2 className="animate-spin" /> : (
            <>
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Cadastrar com Google
            </>
          )}
        </button>
      </div>

      <div className="text-center">
        <button onClick={() => setView('login')} className="text-brand-blue font-bold text-sm">Já tenho uma conta</button>
      </div>
    </div>
  );
};

const JournalView = ({ user, settings, setView, addJournalEntry, journalEntries, deleteJournalEntry }: any) => {
  const [newEntry, setNewEntry] = useState('');
  const [entryType, setEntryType] = useState<'reflection' | 'prayer' | 'thought'>('reflection');

  if (!user) {
    return (
      <div className="py-20 text-center space-y-6">
        <div className="w-20 h-20 bg-brand-blue/5 text-brand-blue rounded-full flex items-center justify-center mx-auto">
          <Lock size={40} />
        </div>
        <div className="space-y-2">
          <h2 className={`text-2xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Área Restrita</h2>
          <p className="text-stone-500 max-w-[250px] mx-auto">O Diário Espiritual está disponível apenas para usuários registrados.</p>
        </div>
        <button 
          onClick={() => setView('login')}
          className="px-8 py-3 bg-brand-blue text-white rounded-xl font-bold shadow-lg shadow-brand-blue/20"
        >
          Entrar Agora
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <h1 className={`text-3xl font-bold ${settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-800'}`}>Diário</h1>
        <div className="flex gap-2">
          {(['reflection', 'prayer', 'thought'] as const).map(t => (
            <button 
              key={t}
              onClick={() => setEntryType(t)}
              className={`px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${
                entryType === t 
                ? 'bg-brand-blue text-white' 
                : (settings.theme === 'dark' ? 'bg-white/5 text-stone-500' : 'bg-stone-100 text-stone-400')
              }`}
            >
              {t === 'reflection' ? 'Reflexão' : t === 'prayer' ? 'Oração' : 'Pensamento'}
            </button>
          ))}
        </div>
      </header>

      <div className={`p-4 rounded-3xl border shadow-sm space-y-3 ${
        settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
      }`}>
        <textarea 
          placeholder={entryType === 'reflection' ? "O que Deus falou com você hoje?" : entryType === 'prayer' ? "Registre seu pedido de oração..." : "Um pensamento espiritual do dia..."}
          value={newEntry}
          onChange={(e) => setNewEntry(e.target.value)}
          className={`w-full min-h-[120px] bg-transparent border-none outline-none resize-none text-lg font-serif ${
            settings.theme === 'dark' ? 'text-dark-text' : 'text-stone-700'
          }`}
        />
        <div className="flex justify-end">
          <button 
            onClick={() => { if (newEntry.trim()) { addJournalEntry(entryType, newEntry); setNewEntry(''); } }}
            className="px-6 py-2 bg-brand-blue text-white rounded-xl font-bold text-sm flex items-center gap-2"
          >
            <Plus size={16} /> Salvar
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionHeader theme={settings.theme}>Suas Reflexões</SectionHeader>
        {journalEntries.length === 0 ? (
          <p className="text-center py-10 text-stone-400 italic">Nenhum registro ainda.</p>
        ) : (
          journalEntries.map((entry: any) => (
            <div key={entry.id} className={`p-5 rounded-3xl border shadow-sm space-y-3 relative group ${
              settings.theme === 'dark' ? 'bg-dark-card border-white/5' : 'bg-white border-brand-gray'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                  entry.type === 'reflection' ? 'bg-brand-blue/10 text-brand-blue' : 
                  entry.type === 'prayer' ? 'bg-brand-sage/20 text-brand-sage' : 
                  'bg-stone-100 text-stone-500'
                }`}>
                  {entry.type === 'reflection' ? 'Reflexão' : entry.type === 'prayer' ? 'Oração' : 'Pensamento'}
                </span>
                <span className="text-[10px] text-stone-400">{new Date(entry.created_at).toLocaleDateString()}</span>
              </div>
              <p className={`font-serif leading-relaxed ${settings.theme === 'dark' ? 'text-stone-300' : 'text-stone-700'}`}>{entry.content}</p>
              <button 
                onClick={() => deleteJournalEntry(entry.id)}
                className="absolute top-4 right-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
