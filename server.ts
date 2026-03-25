import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
const db = new Database("biblia_simples.db");

// Initialize DB
db.exec(`
  CREATE TABLE IF NOT EXISTS topics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tema TEXT UNIQUE,
    versiculo TEXT,
    explicacao TEXT,
    contexto TEXT,
    aplicacao TEXT,
    devocional TEXT,
    oracao TEXT,
    perguntas TEXT,
    tags TEXT,
    is_ai_generated INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT,
    content_id INTEGER,
    title TEXT,
    subtitle TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS read_devotionals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic_id INTEGER,
    read_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    email TEXT UNIQUE,
    password TEXT,
    role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    type TEXT,
    content TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS study_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT,
    description TEXT,
    category TEXT,
    duration_days INTEGER,
    is_premium INTEGER DEFAULT 1
  );

  CREATE TABLE IF NOT EXISTS study_plan_days (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_id INTEGER,
    day_number INTEGER,
    title TEXT,
    versiculo TEXT,
    explicacao TEXT,
    aplicacao TEXT,
    pergunta TEXT,
    oracao TEXT
  );
`);

// Migration: Add title column to study_plan_days if it doesn't exist
try {
  db.exec("ALTER TABLE study_plan_days ADD COLUMN title TEXT;");
} catch (e) {
  // Column already exists or table doesn't exist yet (handled by CREATE TABLE)
}

// Seed default admin if not exists
const adminExists = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(
    "Admin", "admin@biblia.com", "admin123", "admin"
  );
}

// Seed study plans if empty
const plansCount = (db.prepare("SELECT COUNT(*) as count FROM study_plans").get() as any).count;
if (plansCount === 0 || plansCount < 10) { // Check for low count to replace old seed
  db.prepare("DELETE FROM study_plans").run();
  db.prepare("DELETE FROM study_plan_days").run();

  const plans = [
    { 
      title: "Paz Interior", 
      category: "Paz Interior",
      desc: "Encontre tranquilidade e descanso para sua alma.",
      days: [
        {
          title: "Ansiedade",
          reflexao: "A ansiedade muitas vezes nasce da tentativa de controlar o que ainda não aconteceu. A mente corre para o futuro imaginando cenários e problemas que talvez nunca existam. Jesus ensinou que cada dia tem suas próprias preocupações e que a confiança em Deus nos ajuda a viver o presente com mais paz. A fé não elimina todos os problemas, mas nos lembra que não estamos sozinhos no meio deles.",
          versiculo: "Não andeis ansiosos por coisa alguma. (Filipenses 4:6)",
          aplicacao: "Hoje escolha entregar a Deus uma preocupação específica que está ocupando sua mente.",
          pergunta: "O que tem ocupado demais seus pensamentos ultimamente?",
          oracao: "Deus, ajuda-me a confiar em Ti e descansar nas Tuas mãos."
        },
        {
          title: "Cansaço da Alma",
          reflexao: "Há momentos em que o cansaço não está apenas no corpo, mas no coração. Pressões, responsabilidades e frustrações podem gerar um peso interior difícil de explicar. Jesus fez um convite simples e profundo: vir até Ele e encontrar descanso. Esse descanso não significa ausência de problemas, mas a presença de Deus no meio deles.",
          versiculo: "Vinde a mim todos os que estão cansados. (Mateus 11:28)",
          aplicacao: "Reserve alguns minutos hoje para silenciar sua mente e respirar profundamente.",
          pergunta: "O que mais tem pesado sobre você ultimamente?",
          oracao: "Senhor, minha alma está cansada. Ajuda-me a encontrar descanso em Ti."
        },
        {
          title: "Medo do Futuro",
          reflexao: "O futuro é desconhecido e por isso muitas vezes gera medo. Nossa mente tenta antecipar problemas e controlar aquilo que ainda não chegou. A fé nos ensina algo diferente: confiar que Deus já está presente no amanhã. Mesmo quando não sabemos exatamente o que virá, podemos caminhar com a certeza de que não estamos sozinhos.",
          versiculo: "Não temas, porque eu sou contigo. (Isaías 41:10)",
          aplicacao: "Lembre-se hoje de que Deus já está presente nos dias que ainda virão.",
          pergunta: "Qual é o maior medo que você tem sobre o futuro?",
          oracao: "Deus, ensina-me a confiar no Teu cuidado."
        },
        {
          title: "Sentimento de Culpa",
          reflexao: "A culpa pode aprisionar o coração ao passado. Quando erramos, muitas vezes carregamos dentro de nós um peso constante. A mensagem da Bíblia mostra que o perdão de Deus oferece um novo começo. Reconhecer nossos erros é importante, mas permanecer preso a eles impede o crescimento.",
          versiculo: "Se confessarmos os nossos pecados, ele é fiel para nos perdoar. (1 João 1:9)",
          aplicacao: "Reconheça seus erros, receba o perdão de Deus e permita-se recomeçar.",
          pergunta: "Existe algo do passado que você ainda não conseguiu deixar para trás?",
          oracao: "Deus, ajuda-me a aceitar o Teu perdão."
        },
        {
          title: "Quando Deus Parece Distante",
          reflexao: "Há momentos na vida espiritual em que sentimos silêncio. Oramos e parece que nada acontece. Muitas pessoas na Bíblia também passaram por isso. O silêncio de Deus não significa ausência, mas muitas vezes um tempo de amadurecimento. Mesmo quando não sentimos, Ele continua presente.",
          versiculo: "Perto está o Senhor de todos os que o invocam. (Salmos 145:18)",
          aplicacao: "Continue buscando a Deus, mesmo quando os sentimentos dizem o contrário.",
          pergunta: "Você já passou por momentos em que Deus parecia distante?",
          oracao: "Senhor, mesmo quando não Te sinto, ajuda-me a confiar em Ti."
        }
      ]
    },
    { 
      title: "Crescimento Espiritual", 
      category: "Crescimento Espiritual",
      desc: "Amadureça sua fé e fortaleça sua caminhada com Deus.",
      days: [
        {
          title: "Fortalecendo a Fé",
          reflexao: "A fé não cresce apenas em momentos extraordinários. Ela se desenvolve nas pequenas decisões diárias de confiar em Deus. Cada vez que escolhemos confiar, mesmo diante de dúvidas, nossa fé amadurece um pouco mais.",
          versiculo: "O justo viverá pela fé. (Romanos 1:17)",
          aplicacao: "Hoje pratique confiar em Deus em algo pequeno.",
          pergunta: "Em qual área da sua vida você precisa confiar mais em Deus?",
          oracao: "Senhor, fortalece minha fé."
        },
        {
          title: "Aprendendo a Confiar",
          reflexao: "Confiar em Deus não significa entender todas as respostas. Muitas vezes significa apenas continuar caminhando mesmo quando o caminho parece incerto.",
          versiculo: "Confia no Senhor de todo o teu coração. (Provérbios 3:5)",
          aplicacao: "Entregue hoje uma preocupação específica a Deus.",
          pergunta: "O que hoje está mais difícil de confiar?",
          oracao: "Deus, ajuda-me a confiar em Ti mesmo sem entender tudo."
        },
        {
          title: "Perseverança",
          reflexao: "A caminhada espiritual possui desafios. Existem momentos de entusiasmo e momentos de desânimo. A perseverança é continuar caminhando mesmo quando a motivação diminui.",
          versiculo: "Sede firmes e constantes. (1 Coríntios 15:58)",
          aplicacao: "Não desista de caminhar espiritualmente, mesmo em dias difíceis.",
          pergunta: "O que tem desanimado você ultimamente?",
          oracao: "Senhor, dá-me força para continuar."
        },
        {
          title: "O Silêncio de Deus",
          reflexao: "Deus nem sempre responde imediatamente. Às vezes o silêncio nos ensina paciência, confiança e maturidade espiritual.",
          versiculo: "Aquietai-vos e sabei que eu sou Deus. (Salmos 46:10)",
          aplicacao: "Aprenda a esperar em Deus com paciência.",
          pergunta: "Você tem dificuldade em esperar respostas?",
          oracao: "Deus, ensina-me a esperar em Ti."
        },
        {
          title: "Esperança",
          reflexao: "A esperança cristã não depende das circunstâncias. Ela nasce da confiança de que Deus continua conduzindo a história mesmo quando não entendemos tudo.",
          versiculo: "A esperança não decepciona. (Romanos 5:5)",
          aplicacao: "Lembre-se hoje de que dias difíceis não duram para sempre.",
          pergunta: "O que hoje renova sua esperança?",
          oracao: "Senhor, renova minha esperança."
        }
      ]
    },
    { 
      title: "Vida Real", 
      category: "Vida Real",
      desc: "Aplique os princípios bíblicos nos desafios do dia a dia.",
      days: [
        {
          title: "Perdão",
          reflexao: "Guardar mágoa pode prender o coração ao passado. O perdão não apaga o que aconteceu, mas liberta quem decide perdoar.",
          versiculo: "Perdoai uns aos outros. (Colossenses 3:13)",
          aplicacao: "Peça a Deus ajuda para liberar o perdão.",
          pergunta: "Existe alguém que você ainda não conseguiu perdoar?",
          oracao: "Deus, ajuda-me a liberar perdão."
        },
        {
          title: "Conflitos Familiares",
          reflexao: "Famílias são formadas por pessoas imperfeitas. O amor, o diálogo e a paciência ajudam a restaurar relacionamentos.",
          versiculo: "Se possível, tende paz com todos. (Romanos 12:18)",
          aplicacao: "Dê hoje um pequeno passo em direção à reconciliação.",
          pergunta: "Existe alguma conversa que você precisa ter?",
          oracao: "Senhor, ajuda-me a construir pontes."
        },
        {
          title: "Propósito de Vida",
          reflexao: "Todos buscamos significado para nossa existência. A Bíblia nos ensina que servir e amar dão propósito à vida.",
          versiculo: "Cada um exerça o dom que recebeu. (1 Pedro 4:10)",
          aplicacao: "Hoje faça algo que abençoe alguém.",
          pergunta: "Como você pode fazer diferença na vida de alguém hoje?",
          oracao: "Deus, mostra-me meu propósito."
        },
        {
          title: "Pressões do Trabalho",
          reflexao: "O trabalho pode gerar pressão e ansiedade. A sabedoria está em trabalhar com dedicação sem permitir que o trabalho roube nossa paz interior.",
          versiculo: "Tudo o que fizerem, façam de todo o coração. (Colossenses 3:23)",
          aplicacao: "Faça o seu melhor, mas cuide também da sua saúde emocional.",
          pergunta: "O trabalho tem tirado sua paz?",
          oracao: "Senhor, ajuda-me a equilibrar minha vida."
        },
        {
          title: "Decisões Difíceis",
          reflexao: "Em muitos momentos da vida precisamos tomar decisões importantes. Buscar sabedoria em Deus nos ajuda a caminhar com mais segurança.",
          versiculo: "Se alguém precisa de sabedoria, peça a Deus. (Tiago 1:5)",
          aplicacao: "Ore antes de tomar decisões importantes.",
          pergunta: "Existe alguma decisão que você precisa tomar?",
          oracao: "Deus, guia minhas escolhas."
        }
      ]
    },
    { 
      title: "Cura Emocional", 
      category: "Cura Emocional",
      desc: "Reflexões para restaurar o coração e as emoções.",
      days: [
        {
          title: "Ansiedade",
          reflexao: "A ansiedade é como uma tempestade interna que tenta nos convencer de que o pior vai acontecer. No entanto, Deus nos convida a entregar nossas preocupações a Ele, lembrando que Seu cuidado é constante e Sua paz é real.",
          versiculo: "Lancem sobre ele toda a sua ansiedade, porque ele tem cuidado de vocês. (1 Pedro 5:7)",
          aplicacao: "Sempre que um pensamento ansioso surgir hoje, responda com uma curta oração de confiança.",
          pergunta: "Qual pensamento ansioso você precisa entregar a Deus agora?",
          oracao: "Senhor, acalma meu coração e ajuda-me a descansar no Teu cuidado."
        },
        {
          title: "Rejeição",
          reflexao: "A dor da rejeição pode nos fazer sentir sem valor. Mas a verdade bíblica é que fomos escolhidos por Deus antes mesmo de nascermos. O amor Dele não depende do que os outros pensam de nós.",
          versiculo: "Pois o Senhor não rejeitará o seu povo. (Salmos 94:14)",
          aplicacao: "Afirme hoje que seu valor vem de ser filho(a) de Deus, não da aprovação humana.",
          pergunta: "Em quem você tem buscado sua validação ultimamente?",
          oracao: "Pai, obrigado por me amar e me aceitar exatamente como eu sou."
        },
        {
          title: "Culpa",
          reflexao: "A culpa tenta nos manter presos ao passado e aos nossos erros. Mas em Jesus, há perdão total e a oportunidade de um novo começo. O arrependimento nos liberta para caminhar em novidade de vida.",
          versiculo: "Agora, pois, já nenhuma condenação há para os que estão em Cristo Jesus. (Romanos 8:1)",
          aplicacao: "Peça perdão por um erro específico e escolha acreditar que Deus já te perdoou.",
          pergunta: "Você ainda se culpa por algo que Deus já perdoou?",
          oracao: "Senhor, recebo Teu perdão e escolho não me condenar mais."
        },
        {
          title: "Esgotamento Emocional",
          reflexao: "O esgotamento acontece quando tentamos carregar o mundo nos ombros. Jesus nos chama para trocar nosso fardo pesado pelo Dele, que é leve. Descansar Nele é a cura para a alma exausta.",
          versiculo: "Vinde a mim, todos os que estais cansados e oprimidos, e eu vos aliviarei. (Mateus 11:28)",
          aplicacao: "Identifique uma tarefa ou preocupação que você pode 'soltar' hoje para descansar.",
          pergunta: "O que tem drenado suas energias emocionais ultimamente?",
          oracao: "Jesus, entrego meu cansaço a Ti. Renova minhas forças e minha paz."
        },
        {
          title: "Medo do Futuro",
          reflexao: "O medo do futuro é a incerteza tentando roubar nossa paz presente. Deus, que é o dono do tempo, promete estar conosco em cada passo. O amanhã está seguro nas mãos Daquele que nos ama.",
          versiculo: "Porque eu bem sei os pensamentos que tenho a vosso respeito, diz o Senhor; pensamentos de paz, e não de mal. (Jeremias 29:11)",
          aplicacao: "Escreva um plano para o futuro e coloque-o diante de Deus em oração.",
          pergunta: "O que mais te assusta quando você pensa no amanhã?",
          oracao: "Pai, confio meu futuro a Ti. Sei que Teus planos para mim são bons."
        },
        {
          title: "Solidão",
          reflexao: "A solidão pode ser um deserto silencioso, mas Deus promete que nunca nos deixará. Mesmo quando nos sentimos sozinhos, a presença Dele é uma companhia constante e reconfortante.",
          versiculo: "E eis que eu estou convosco todos os dias, até a consumação dos séculos. (Mateus 28:20)",
          aplicacao: "Aproveite um momento de silêncio hoje para simplesmente desfrutar da companhia de Deus.",
          pergunta: "Como você pode cultivar mais a consciência da presença de Deus?",
          oracao: "Senhor, obrigado por nunca me abandonar. Sinto Tua presença comigo."
        },
        {
          title: "Feridas do Passado",
          reflexao: "Feridas antigas podem doer por muito tempo, mas Deus é o restaurador de almas. Ele pode curar as memórias dolorosas e nos dar beleza em vez de cinzas.",
          versiculo: "Ele cura os que têm o coração quebrantado e trata das suas feridas. (Salmos 147:3)",
          aplicacao: "Entregue uma memória dolorosa a Deus e peça que Ele traga cura a essa área.",
          pergunta: "Qual ferida do passado ainda dói quando você se lembra dela?",
          oracao: "Pai, cura minhas feridas e ajuda-me a seguir em frente com Tua paz."
        },
        {
          title: "Falta de Propósito",
          reflexao: "Sentir-se sem rumo é angustiante, mas Deus nos criou com um propósito específico. Nossa vida tem significado porque fomos planejados por Ele para boas obras.",
          versiculo: "Porque somos feitura sua, criados em Cristo Jesus para as boas obras. (Efésios 2:10)",
          aplicacao: "Peça a Deus hoje que mostre como você pode servir a alguém com seus talentos.",
          pergunta: "O que faz seu coração vibrar e como isso pode glorificar a Deus?",
          oracao: "Senhor, mostra-me o propósito para o qual me criaste. Quero Te servir."
        },
        {
          title: "Desânimo",
          reflexao: "O desânimo tenta nos fazer parar no meio do caminho. Mas a força de Deus se aperfeiçoa na nossa fraqueza. Ele nos dá novo fôlego para continuar a jornada.",
          versiculo: "Mas os que esperam no Senhor renovarão as suas forças. (Isaías 40:31)",
          aplicacao: "Faça algo pequeno hoje que te traga alegria e renove seu ânimo.",
          pergunta: "O que causou o desânimo que você sente hoje?",
          oracao: "Deus, renova minhas forças e devolve-me a alegria de caminhar Contigo."
        },
        {
          title: "Insegurança",
          reflexao: "A insegurança nasce quando olhamos para nossas limitações. A segurança real vem de saber que Deus é nossa rocha e nossa fortaleza inabalável.",
          versiculo: "O Senhor é a minha luz e a minha salvação; a quem temerei? (Salmos 27:1)",
          aplicacao: "Declare em voz alta hoje que sua segurança está no Senhor.",
          pergunta: "Em que situações você se sente mais inseguro(a)?",
          oracao: "Senhor, Tu és minha segurança. Não temerei, pois estás comigo."
        }
      ]
    },
    { 
      title: "Perguntas Difíceis da Fé", 
      category: "Perguntas Difíceis da Fé",
      desc: "Respostas simples e profundas para dúvidas comuns.",
      days: [
        {
          title: "Por que Deus permite o sofrimento?",
          reflexao: "O sofrimento é uma realidade difícil em um mundo marcado pelo livre-arbítrio e pelo pecado. Deus não é o autor da dor, mas Ele é o redentor dela. Ele usa as aflições para moldar nosso caráter, produzir perseverança e nos ensinar a depender inteiramente Dele. No sofrimento, descobrimos uma profundidade de relacionamento com Deus que não encontraríamos no conforto.",
          versiculo: "Tenho-vos dito isto, para que em mim tenhais paz; no mundo tereis aflições, mas tende bom ânimo, eu venci o mundo. (João 16:33)",
          aplicacao: "Em vez de perguntar 'por que', pergunte a Deus 'como' você pode crescer através desta situação.",
          pergunta: "Como você tem visto o cuidado de Deus mesmo em tempos de dor?",
          oracao: "Senhor, ajuda-me a confiar em Tua bondade mesmo quando a vida dói."
        },
        {
          title: "Como ouvir a voz de Deus?",
          reflexao: "Ouvir a Deus raramente é algo audível, mas sim um sussurro no coração, uma paz que confirma um caminho ou a clareza através da Sua Palavra. Deus fala no silêncio, na oração e através de circunstâncias. Para ouvir, precisamos aprender a silenciar o barulho do mundo e sintonizar nosso coração com o Dele.",
          versiculo: "As minhas ovelhas ouvem a minha voz, e eu conheço-as, e elas me seguem. (João 10:27)",
          aplicacao: "Reserve 5 minutos de silêncio total hoje apenas para 'ouvir' o que Deus coloca em seu coração.",
          pergunta: "O que tem impedido você de ouvir a voz de Deus ultimamente?",
          oracao: "Pai, limpa meus ouvidos espirituais para que eu possa discernir Tua voz."
        },
        {
          title: "O que fazer quando a fé esfria?",
          reflexao: "A fé não é apenas um sentimento, mas uma decisão. Quando as emoções esfriam, é hora de voltar ao básico: oração, leitura da Bíblia e comunhão. Como uma brasa que precisa de ar, nossa fé precisa ser alimentada constantemente pela presença de Deus e pela lembrança de Suas promessas passadas.",
          versiculo: "Aproximai-vos de Deus, e ele se aproximará de vós. (Tiago 4:8)",
          aplicacao: "Leia hoje um versículo que você ama e medite nele por alguns minutos.",
          pergunta: "Qual foi o momento em que sua fé esteve mais vibrante e o que mudou?",
          oracao: "Senhor, reacende a chama do meu coração. Quero Te buscar com fervor novamente."
        },
        {
          title: "Como lidar com dúvidas espirituais?",
          reflexao: "Ter dúvidas não é pecado; é um convite para buscar respostas mais profundas. Até os discípulos de Jesus tiveram dúvidas. Deus não se assusta com nossos questionamentos. Ele nos convida a levar nossas dúvidas a Ele, buscando sabedoria e entendimento através do estudo e da oração sincera.",
          versiculo: "E, se algum de vós tem falta de sabedoria, peça-a a Deus. (Tiago 1:5)",
          aplicacao: "Escolha uma dúvida que você tem e pesquise o que a Bíblia diz sobre esse assunto hoje.",
          pergunta: "Qual dúvida tem mais incomodado sua caminhada com Deus?",
          oracao: "Deus, ajuda-me nas minhas dúvidas e guia-me à Tua verdade."
        },
        {
          title: "Como confiar em Deus em tempos difíceis?",
          reflexao: "Confiança é fé em ação quando as circunstâncias são contrárias. É acreditar no caráter de Deus mesmo quando não entendemos Seus métodos. Confiar em tempos difíceis significa soltar o controle e acreditar que Aquele que começou a boa obra é fiel para completá-la, independentemente do que vemos agora.",
          versiculo: "Confia no Senhor de todo o teu coração, e não te estribes no teu próprio entendimento. (Provérbios 3:5)",
          aplicacao: "Declare hoje: 'Senhor, eu não entendo, mas eu confio em Ti'.",
          pergunta: "O que hoje está mais difícil de entregar nas mãos de Deus?",
          oracao: "Pai, eu escolho confiar em Ti acima do que meus olhos veem."
        },
        {
          title: "Por que às vezes Deus parece em silêncio?",
          reflexao: "O silêncio de Deus não é ausência de Deus. Às vezes, o silêncio é pedagógico, ensinando-nos a esperar, a amadurecer e a buscar a face Dele em vez de apenas Suas mãos. No silêncio, Deus está trabalhando nos bastidores, preparando algo que ainda não podemos ver.",
          versiculo: "Aquietai-vos, e sabei que eu sou Deus. (Salmos 46:10)",
          aplicacao: "Agradeça a Deus hoje pelo que Ele está fazendo, mesmo que você não esteja ouvindo nada.",
          pergunta: "Como você reage quando ora e não recebe uma resposta imediata?",
          oracao: "Senhor, ajuda-me a descansar em Teu silêncio, sabendo que estás agindo."
        },
        {
          title: "Como fortalecer a fé?",
          reflexao: "A fé é como um músculo: ela se fortalece com o exercício. Exercitamos a fé quando obedecemos a Deus em pequenas coisas, quando lemos Sua Palavra e quando compartilhamos o que Ele tem feito. Quanto mais conhecemos a Deus, mais fácil se torna confiar Nele, e nossa fé cresce naturalmente.",
          versiculo: "De sorte que a fé é pelo ouvir, e o ouvir pela palavra de Deus. (Romanos 10:17)",
          aplicacao: "Ouça ou leia uma pregação ou estudo bíblico hoje para alimentar sua fé.",
          pergunta: "Qual hábito diário você pode adotar para fortalecer sua fé?",
          oracao: "Deus, alimenta minha alma com Tua verdade e fortalece minha fé dia após dia."
        },
        {
          title: "Como encontrar propósito na vida?",
          reflexao: "Nosso propósito maior é glorificar a Deus e amar as pessoas. Dentro disso, Deus nos deu talentos e paixões únicas. Encontramos nosso propósito específico quando alinhamos nossos dons com as necessidades do mundo ao nosso redor, sempre buscando a direção do Espírito Santo.",
          versiculo: "Porque somos feitura sua, criados em Cristo Jesus para as boas obras. (Efésios 2:10)",
          aplicacao: "Pense em algo que você faz bem e como isso pode ajudar alguém hoje.",
          pergunta: "O que você faria se soubesse que não poderia falhar para Deus?",
          oracao: "Senhor, guia meus passos para o propósito que tens para minha vida."
        },
        {
          title: "Deus se importa com meus problemas?",
          reflexao: "Muitas vezes achamos que nossos problemas são pequenos demais para o Criador do universo. Mas a Bíblia diz que Ele conhece até o número de fios de cabelo da nossa cabeça. Não há nada que nos aflija que não toque o coração de Deus. Ele se importa com cada detalhe da nossa vida.",
          versiculo: "Lançando sobre ele toda a vossa ansiedade, porque ele tem cuidado de vós. (1 Pedro 5:7)",
          aplicacao: "Fale com Deus hoje sobre um problema 'pequeno' que tem te incomodado.",
          pergunta: "Você sente que alguns de seus problemas são 'indignos' da atenção de Deus?",
          oracao: "Pai, obrigado por cuidar de cada detalhe da minha vida, por menor que seja."
        },
        {
          title: "Como recomeçar espiritualmente?",
          reflexao: "Recomeçar é aceitar a graça de Deus que se renova a cada manhã. Não importa quão longe você tenha ido ou quanto tempo tenha passado, o caminho de volta está sempre aberto. Recomeçar exige humildade para reconhecer a necessidade de Deus e coragem para dar o primeiro passo de volta à comunhão.",
          versiculo: "As misericórdias do Senhor são a causa de não sermos consumidos... renovam-se cada manhã. (Lamentações 3:22-23)",
          aplicacao: "Hoje é um novo dia. Peça perdão pelo passado e comece agora uma nova conversa com Deus.",
          pergunta: "O que impede você de dar o primeiro passo para um novo começo hoje?",
          oracao: "Senhor, obrigado por Tua graça que me permite recomeçar. Eis-me aqui novamente."
        }
      ]
    },
    { 
      title: "Ensinos de Jesus", 
      category: "Ensinos de Jesus",
      desc: "Aprofunde-se nas palavras e lições do Mestre.",
      days: [
        {
          title: "Amar o Próximo",
          reflexao: "Jesus elevou o amor ao próximo ao nível do amor a Deus. Esse amor não é um sentimento passageiro, mas uma decisão de buscar o bem do outro, mesmo quando é difícil. Amar como Jesus amou significa servir, perdoar e acolher, transformando o mundo através de relacionamentos restaurados.",
          versiculo: "Um novo mandamento vos dou: Que vos ameis uns aos outros; como eu vos amei a vós. (João 13:34)",
          aplicacao: "Demonstre amor a alguém hoje através de um gesto prático de serviço.",
          pergunta: "Quem é a pessoa mais difícil de amar em sua vida hoje?",
          oracao: "Jesus, ensina-me a amar as pessoas com o mesmo amor sacrificial que tens por mim."
        },
        {
          title: "Perdão",
          reflexao: "O perdão é a base do ensinamento de Jesus. Ele nos ensinou que fomos perdoados de uma dívida impagável e, por isso, devemos perdoar aqueles que nos ofendem. O perdão liberta o coração do peso da amargura e abre as portas para a paz de Deus fluir em nós.",
          versiculo: "E, quando estiverdes orando, perdoai, se tendes alguma coisa contra alguém. (Marcos 11:25)",
          aplicacao: "Escolha perdoar alguém hoje, mesmo que essa pessoa não tenha pedido perdão.",
          pergunta: "A quem você precisa liberar perdão para que seu coração seja livre?",
          oracao: "Senhor, ajuda-me a perdoar assim como fui perdoado por Ti."
        },
        {
          title: "Ansiedade",
          reflexao: "Jesus nos convida a olhar para a natureza e ver como Deus cuida de tudo. Se Ele cuida das aves e das flores, quanto mais cuidará de nós! A ansiedade é um sinal de que estamos tentando carregar o amanhã hoje. Confiar no Pai é a cura para a mente inquieta.",
          versiculo: "Não vos inquieteis, pois, pelo dia de amanhã, porque o dia de amanhã cuidará de si mesmo. (Mateus 6:34)",
          aplicacao: "Sempre que se sentir ansioso hoje, pare e observe algo da criação de Deus.",
          pergunta: "O que você está tentando controlar que deveria entregar a Deus?",
          oracao: "Pai, confio no Teu sustento diário. Ajuda-me a viver um dia de cada vez."
        },
        {
          title: "Humildade",
          reflexao: "No Reino de Deus, os últimos serão os primeiros. Jesus, sendo Deus, lavou os pés dos discípulos, ensinando que a verdadeira grandeza está no serviço humilde. A humildade nos permite aprender, crescer e nos conectar verdadeiramente com Deus e com as pessoas.",
          versiculo: "Porque qualquer que a si mesmo se exaltar será humilhado, e qualquer que a si mesmo se humilhar será exaltado. (Lucas 14:11)",
          aplicacao: "Procure uma oportunidade de servir alguém de forma anônima hoje.",
          pergunta: "Em que áreas da vida você tem buscado reconhecimento em vez de serviço?",
          oracao: "Jesus, dá-me um coração humilde como o Teu. Quero servir e não ser servido."
        },
        {
          title: "Servir aos Outros",
          reflexao: "Servir é o amor em ação. Jesus não veio para ser servido, mas para servir. Quando servimos aos outros, estamos refletindo o caráter de Cristo e espalhando a luz do Reino. O serviço quebra o egoísmo e nos aproxima do coração de Deus.",
          versiculo: "Bem como o Filho do homem não veio para ser servido, mas para servir. (Mateus 20:28)",
          aplicacao: "Ajude alguém hoje em uma tarefa simples, sem esperar nada em troca.",
          pergunta: "Como você pode usar seus talentos para servir sua comunidade hoje?",
          oracao: "Senhor, usa minhas mãos e meu coração para servir ao meu próximo com alegria."
        },
        {
          title: "Confiança em Deus",
          reflexao: "A confiança em Deus é a âncora da alma. Jesus demonstrou confiança total no Pai, mesmo diante da morte. Confiar significa acreditar que Deus é bom, que Ele está no controle e que Seus planos são perfeitos, mesmo quando o caminho é difícil.",
          versiculo: "Não se turbe o vosso coração; credes em Deus, crede também em mim. (João 14:1)",
          aplicacao: "Repita para si mesmo hoje: 'Deus está no controle e eu confio Nele'.",
          pergunta: "Qual situação hoje mais desafia sua confiança em Deus?",
          oracao: "Pai, eu escolho confiar em Ti, independentemente das circunstâncias ao meu redor."
        },
        {
          title: "Vida Simples",
          reflexao: "Jesus viveu uma vida simples, focada no que é eterno. Ele nos alertou sobre o perigo de acumular tesouros na terra, onde tudo passa. Uma vida simples nos permite focar no que realmente importa: Deus, relacionamentos e o Reino.",
          versiculo: "Porque a vida de qualquer não consiste na abundância das coisas que possui. (Lucas 12:15)",
          aplicacao: "Escolha simplificar algo em sua rotina hoje para ter mais tempo com Deus.",
          pergunta: "O que em sua vida tem se tornado um excesso que te afasta do essencial?",
          oracao: "Senhor, ensina-me a viver com contentamento e a valorizar o que é eterno."
        },
        {
          title: "Misericórdia",
          reflexao: "Misericórdia é não dar às pessoas o que elas merecem (julgamento), mas sim o que elas precisam (amor e compaixão). Jesus foi a personificação da misericórdia. Ser misericordioso nos torna mais parecidos com nosso Pai celestial.",
          versiculo: "Bem-aventurados os misericordiosos, porque eles alcançarão misericórdia. (Mateus 5:7)",
          aplicacao: "Seja paciente e compreensivo com alguém que cometeu um erro hoje.",
          pergunta: "Quem em sua vida hoje mais precisa de um gesto de misericórdia?",
          oracao: "Pai, obrigado por Tua misericórdia infinita. Ajuda-me a ser misericordioso com os outros."
        },
        {
          title: "Coração Puro",
          reflexao: "A pureza de coração não é perfeição, mas sinceridade e integridade diante de Deus. É buscar a Deus com motivos limpos e um desejo genuíno de agradá-Lo. Um coração puro nos permite ver a Deus agindo em todas as coisas.",
          versiculo: "Bem-aventurados os limpos de coração, porque eles verão a Deus. (Mateus 5:8)",
          aplicacao: "Peça a Deus hoje que examine suas motivações em tudo o que você fizer.",
          pergunta: "O que tem 'sujado' suas intenções e pensamentos ultimamente?",
          oracao: "Cria em mim, ó Deus, um coração puro e renova em mim um espírito reto."
        },
        {
          title: "Buscar primeiro o Reino de Deus",
          reflexao: "Nossas prioridades definem nossa vida. Jesus ensinou que, se colocarmos Deus e Sua vontade em primeiro lugar, todas as outras necessidades serão cuidadas por Ele. Buscar o Reino é viver sob o governo de Deus em cada decisão.",
          versiculo: "Mas, buscai primeiro o reino de Deus, e a sua justiça, e todas estas coisas vos serão acrescentadas. (Mateus 6:33)",
          aplicacao: "Antes de começar seu dia, pergunte a Deus: 'O que o Senhor quer que eu faça hoje?'.",
          pergunta: "O que tem ocupado o primeiro lugar em seu coração ultimamente?",
          oracao: "Senhor, que o Teu Reino venha primeiro em minha vida. Eu Te coloco no centro."
        }
      ]
    },
    { 
      title: "Planos por Tempo", 
      category: "Planos por Tempo",
      desc: "Escolha quanto tempo você tem para se dedicar à Palavra hoje.",
      days: [
        {
          title: "Leitura Rápida (5 min)",
          reflexao: "Mesmo em dias corridos, 5 minutos com Deus podem mudar sua perspectiva. Foque na qualidade da sua presença.",
          versiculo: "Salmo 119:105 - Lâmpada para os meus pés é tua palavra.",
          aplicacao: "Leia o Salmo 121 pausadamente e medite no cuidado de Deus.",
          pergunta: "Como você pode priorizar esses 5 minutos amanhã?",
          oracao: "Senhor, obrigado por este momento de pausa em Tua presença."
        },
        {
          title: "Momento de Reflexão (10 min)",
          reflexao: "Dez minutos permitem um mergulho um pouco mais profundo. Leia o texto e deixe que ele ecoe em seu coração.",
          versiculo: "João 15:5 - Eu sou a videira, vós as varas.",
          aplicacao: "Leia João 15:1-8 e identifique um 'fruto' que você deseja cultivar hoje.",
          pergunta: "O que significa para você 'permanecer' em Cristo?",
          oracao: "Pai, ajuda-me a permanecer conectado a Ti durante todo o dia."
        },
        {
          title: "Estudo Profundo (20 min)",
          reflexao: "Com 20 minutos, você pode ler o contexto, anotar pensamentos e orar com mais calma. É um investimento em sua alma.",
          versiculo: "2 Timóteo 2:15 - Procura apresentar-te a Deus aprovado.",
          aplicacao: "Leia Romanos 8 completo. Anote os versículos que mais chamaram sua atenção.",
          pergunta: "Qual promessa de Romanos 8 mais conforta seu coração hoje?",
          oracao: "Espírito Santo, guia-me em toda a verdade enquanto estudo Tua Palavra."
        },
        {
          title: "Imersão Espiritual (30+ min)",
          reflexao: "Um tempo estendido de comunhão. Leia, ore, adore e ouça. Permita que o Espírito Santo ministre profundamente ao seu ser.",
          versiculo: "Salmo 1:2 - O seu prazer está na lei do Senhor.",
          aplicacao: "Leia o livro de Efésios de uma só vez. Observe a identidade que temos em Cristo.",
          pergunta: "Como sua identidade em Cristo muda a forma como você vê seus desafios?",
          oracao: "Senhor, mergulho em Tua presença. Transforma-me de dentro para fora."
        }
      ]
    }
  ];

  for (const p of plans) {
    const info = db.prepare("INSERT INTO study_plans (title, category, duration_days, description) VALUES (?, ?, ?, ?)").run(p.title, p.category, p.days.length, p.desc);
    const planId = info.lastInsertRowid;
    
    p.days.forEach((day, index) => {
      db.prepare(`
        INSERT INTO study_plan_days (plan_id, day_number, title, versiculo, explicacao, aplicacao, pergunta, oracao)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        planId, index + 1, 
        day.title,
        day.versiculo, 
        day.reflexao, 
        day.aplicacao, 
        day.pergunta, 
        day.oracao
      );
    });
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Digital Bible Route (Using Gemini to fetch text)
  app.get("/api/bible/read", async (req, res) => {
    const { book, chapter } = req.query;
    if (!book || !chapter) return res.status(400).json({ error: "Livro e capítulo são necessários" });

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Retorne o texto completo do capítulo ${chapter} do livro de ${book} da Bíblia (Versão Almeida Revista e Atualizada ou similar).
        Retorne no formato JSON:
        {
          "book": "${book}",
          "chapter": ${chapter},
          "verses": [
            {"number": 1, "text": "..."},
            ...
          ]
        }`,
        config: {
          responseMimeType: "application/json"
        }
      });
      
      const text = response.text || '{}';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleanJson = jsonMatch ? jsonMatch[0] : text;
      res.json(JSON.parse(cleanJson));
    } catch (error) {
      res.status(500).json({ error: "Erro ao buscar texto bíblico" });
    }
  });

  // Auth Routes
  app.post("/api/auth/register", (req, res) => {
    const { name, email, password } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)").run(name, email, password, 'user');
      const user = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE id = ?").get(info.lastInsertRowid);
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: "Email já cadastrado" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT id, name, email, role, created_at FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Credenciais inválidas" });
    }
  });

  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT id, name, email, role, created_at FROM users").all();
    res.json(users);
  });

  // Journal Routes
  app.get("/api/journal/:userId", (req, res) => {
    const entries = db.prepare("SELECT * FROM journal_entries WHERE user_id = ? ORDER BY created_at DESC").all(req.params.userId);
    res.json(entries);
  });

  app.post("/api/journal", (req, res) => {
    const { user_id, type, content } = req.body;
    const info = db.prepare("INSERT INTO journal_entries (user_id, type, content) VALUES (?, ?, ?)").run(user_id, type, content);
    const entry = db.prepare("SELECT * FROM journal_entries WHERE id = ?").get(info.lastInsertRowid);
    res.json(entry);
  });

  app.delete("/api/journal/:id", (req, res) => {
    db.prepare("DELETE FROM journal_entries WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Study Plans Routes
  app.get("/api/study-plans", (req, res) => {
    const plans = db.prepare("SELECT * FROM study_plans").all();
    res.json(plans.map((p: any) => ({ ...p, is_premium: !!p.is_premium })));
  });

  app.get("/api/study-plans/:id/days", (req, res) => {
    const days = db.prepare("SELECT * FROM study_plan_days WHERE plan_id = ? ORDER BY day_number ASC").all(req.params.id);
    res.json(days);
  });

  app.post("/api/study-plans", (req, res) => {
    const { title, description, duration_days, is_premium } = req.body;
    const info = db.prepare("INSERT INTO study_plans (title, description, duration_days, is_premium) VALUES (?, ?, ?, ?)").run(title, description, duration_days, is_premium ? 1 : 0);
    res.json({ id: info.lastInsertRowid });
  });

  app.post("/api/study-plans/:id/days", (req, res) => {
    const { day_number, title, versiculo, explicacao, aplicacao, pergunta, oracao } = req.body;
    db.prepare(`
      INSERT INTO study_plan_days (plan_id, day_number, title, versiculo, explicacao, aplicacao, pergunta, oracao)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(req.params.id, day_number, title, versiculo, explicacao, aplicacao, pergunta, oracao);
    res.json({ success: true });
  });

  // API Routes
  app.get("/api/topics", (req, res) => {
    const topics = db.prepare("SELECT * FROM topics").all();
    res.json(topics.map(t => ({
      ...t,
      perguntas: t.perguntas ? JSON.parse(t.perguntas) : [],
      tags: t.tags ? JSON.parse(t.tags) : [],
      is_ai_generated: !!t.is_ai_generated
    })));
  });

  app.post("/api/topics", (req, res) => {
    const { tema, versiculo, explicacao, contexto, aplicacao, devocional, oracao, perguntas, tags, is_ai_generated } = req.body;
    try {
      // Use INSERT OR REPLACE to update if tema exists
      const info = db.prepare(`
        INSERT INTO topics (tema, versiculo, explicacao, contexto, aplicacao, devocional, oracao, perguntas, tags, is_ai_generated)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(tema) DO UPDATE SET
          versiculo=excluded.versiculo,
          explicacao=excluded.explicacao,
          contexto=excluded.contexto,
          aplicacao=excluded.aplicacao,
          devocional=excluded.devocional,
          oracao=excluded.oracao,
          perguntas=excluded.perguntas,
          tags=excluded.tags,
          is_ai_generated=excluded.is_ai_generated
      `).run(
        tema, 
        versiculo, 
        explicacao, 
        contexto, 
        aplicacao, 
        devocional, 
        oracao, 
        JSON.stringify(perguntas), 
        JSON.stringify(tags), 
        is_ai_generated ? 1 : 0
      );
      
      const topic = db.prepare("SELECT * FROM topics WHERE tema = ?").get(tema) as any;
      res.json({
        ...topic,
        perguntas: topic.perguntas ? JSON.parse(topic.perguntas) : [],
        tags: topic.tags ? JSON.parse(topic.tags) : [],
        is_ai_generated: !!topic.is_ai_generated
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/favorites", (req, res) => {
    const favorites = db.prepare("SELECT * FROM favorites ORDER BY created_at DESC").all();
    res.json(favorites);
  });

  app.post("/api/favorites", (req, res) => {
    const { type, content_id, title, subtitle } = req.body;
    const info = db.prepare(`
      INSERT INTO favorites (type, content_id, title, subtitle)
      VALUES (?, ?, ?, ?)
    `).run(type, content_id, title, subtitle);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/favorites/:id", (req, res) => {
    db.prepare("DELETE FROM favorites WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/read-devotionals", (req, res) => {
    const read = db.prepare("SELECT topic_id FROM read_devotionals").all();
    res.json(read.map((r: any) => r.topic_id));
  });

  app.post("/api/read-devotionals", (req, res) => {
    const { topic_id } = req.body;
    db.prepare("INSERT INTO read_devotionals (topic_id) VALUES (?)").run(topic_id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
