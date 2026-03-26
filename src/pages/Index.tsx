import { useState, useEffect, useRef } from "react";
import Icon from "@/components/ui/icon";

const NAV_LINKS = [
  { label: "Главная", href: "#home" },
  { label: "Проекты", href: "#projects" },
  { label: "Навыки", href: "#skills" },
];

const PROJECTS = [
  {
    id: 1,
    title: "E-commerce платформа",
    category: "Веб-разработка",
    desc: "Полноценный интернет-магазин с корзиной, оплатой и личным кабинетом. Обработка 10 000+ заказов в месяц.",
    tags: ["React", "Node.js", "PostgreSQL"],
    color: "#FF6B35",
    icon: "ShoppingCart",
    year: "2024",
  },
  {
    id: 2,
    title: "CRM-система",
    category: "SaaS",
    desc: "Система управления клиентами для агентства недвижимости. Воронка сделок, аналитика, интеграция с телефонией.",
    tags: ["TypeScript", "Python", "Redis"],
    color: "#A855F7",
    icon: "BarChart3",
    year: "2024",
  },
  {
    id: 3,
    title: "Мобильное приложение",
    category: "Mobile",
    desc: "Приложение для фитнес-трекинга с AI-рекомендациями. 50 000+ активных пользователей.",
    tags: ["React Native", "TensorFlow", "AWS"],
    color: "#06B6D4",
    icon: "Smartphone",
    year: "2023",
  },
  {
    id: 4,
    title: "AI-чатбот",
    category: "Искусственный интеллект",
    desc: "Интеллектуальный помощник для службы поддержки. Снизил нагрузку на операторов на 60%.",
    tags: ["Python", "OpenAI", "FastAPI"],
    color: "#22C55E",
    icon: "Bot",
    year: "2023",
  },
  {
    id: 5,
    title: "Дашборд аналитики",
    category: "Data Visualization",
    desc: "Real-time дашборд для мониторинга бизнес-метрик. Интеграция с 15+ источниками данных.",
    tags: ["D3.js", "GraphQL", "Kafka"],
    color: "#F59E0B",
    icon: "LineChart",
    year: "2023",
  },
  {
    id: 6,
    title: "Маркетплейс услуг",
    category: "Платформа",
    desc: "Двусторонняя платформа для фрилансеров и заказчиков. Встроенная система безопасных сделок.",
    tags: ["Next.js", "Stripe", "Prisma"],
    color: "#EC4899",
    icon: "Layers",
    year: "2022",
  },
];

const SKILLS = [
  { name: "React / Next.js", level: 95, category: "Frontend" },
  { name: "TypeScript", level: 90, category: "Frontend" },
  { name: "CSS / Tailwind", level: 92, category: "Frontend" },
  { name: "Node.js", level: 85, category: "Backend" },
  { name: "Python", level: 80, category: "Backend" },
  { name: "PostgreSQL", level: 78, category: "Backend" },
  { name: "Docker / K8s", level: 72, category: "DevOps" },
  { name: "AWS / Cloud", level: 75, category: "DevOps" },
];

const EXPERIENCE = [
  { year: "2022 — наст.", role: "Senior Frontend Developer", company: "TechCorp", desc: "Разработка SaaS-платформ, руководство командой из 5 разработчиков" },
  { year: "2020 — 2022", role: "Fullstack Developer", company: "Digital Agency", desc: "Создание веб-приложений для клиентов из e-commerce и fintech" },
  { year: "2018 — 2020", role: "Junior Developer", company: "Startup Hub", desc: "Разработка MVP для стартапов на ранних стадиях" },
];

const TAGS_MARQUEE = ["React", "TypeScript", "Python", "Node.js", "PostgreSQL", "Docker", "AWS", "GraphQL", "Redis", "Tailwind", "Next.js", "FastAPI"];

function useScrollReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.disconnect(); } },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, visible };
}

function SkillBar({ skill, index }: { skill: typeof SKILLS[0]; index: number }) {
  const { ref, visible } = useScrollReveal();
  const barColor = skill.level > 88 ? '#FF6B35' : skill.level > 78 ? '#A855F7' : '#06B6D4';
  const barEnd = skill.level > 88 ? '#F59E0B' : skill.level > 78 ? '#06B6D4' : '#22C55E';

  return (
    <div ref={ref} className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-sm font-medium text-white/80">{skill.name}</span>
        <span className="text-xs font-bold" style={{ color: barColor }}>{skill.level}%</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{
            width: visible ? `${skill.level}%` : '0%',
            transitionDelay: `${index * 80}ms`,
            background: `linear-gradient(90deg, ${barColor}, ${barEnd})`,
          }}
        />
      </div>
    </div>
  );
}

function ProjectCard({ project, index }: { project: typeof PROJECTS[0]; index: number }) {
  const { ref, visible } = useScrollReveal();
  return (
    <div
      ref={ref}
      className="card-hover gradient-border rounded-xl p-6 bg-card cursor-pointer group"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(30px)',
        transition: `opacity 0.6s ease ${index * 80}ms, transform 0.6s ease ${index * 80}ms`,
      }}
    >
      <div className="flex items-start justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: `${project.color}20`, border: `1px solid ${project.color}40` }}
        >
          <Icon name={project.icon} size={22} style={{ color: project.color }} />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{project.year}</span>
          <span
            className="text-xs px-2 py-0.5 rounded-full font-medium"
            style={{ background: `${project.color}15`, color: project.color }}
          >
            {project.category}
          </span>
        </div>
      </div>

      <h3 className="text-lg font-bold text-white mb-2 transition-all duration-300 group-hover:opacity-80">
        {project.title}
      </h3>
      <p className="text-sm text-muted-foreground leading-relaxed mb-4">{project.desc}</p>

      <div className="flex flex-wrap gap-1.5">
        {project.tags.map(tag => (
          <span key={tag} className="text-xs px-2 py-0.5 rounded-md bg-white/5 text-white/50 font-mono">
            {tag}
          </span>
        ))}
      </div>

      <div
        className="mt-4 flex items-center gap-1 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ color: project.color }}
      >
        Подробнее <Icon name="ArrowRight" size={12} />
      </div>
    </div>
  );
}

export default function Index() {
  const [activeSection, setActiveSection] = useState("home");
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
      const sections = ["home", "projects", "skills"];
      for (const id of [...sections].reverse()) {
        const el = document.getElementById(id);
        if (el && window.scrollY >= el.offsetTop - 200) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const frontendSkills = SKILLS.filter(s => s.category === "Frontend");
  const backendSkills = SKILLS.filter(s => s.category === "Backend");
  const devopsSkills = SKILLS.filter(s => s.category === "DevOps");

  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/80 backdrop-blur-xl border-b border-white/5' : ''}`}>
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <a href="#home" className="text-lg font-bold font-display italic gradient-text">
            Dev.Portfolio
          </a>
          <div className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors duration-200 relative ${
                  activeSection === link.href.slice(1)
                    ? 'text-white'
                    : 'text-white/50 hover:text-white/80'
                }`}
              >
                {link.label}
                {activeSection === link.href.slice(1) && (
                  <span className="absolute -bottom-0.5 left-0 right-0 h-px bg-gradient-to-r from-[#FF6B35] to-[#A855F7]" />
                )}
              </a>
            ))}
          </div>
          <a
            href="#skills"
            className="hidden md:flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg text-black transition-all duration-200 hover:scale-105"
            style={{ background: 'linear-gradient(135deg, #FF6B35, #A855F7)' }}
          >
            Связаться
          </a>
          <button className="md:hidden text-white/70" onClick={() => setMenuOpen(!menuOpen)}>
            <Icon name={menuOpen ? "X" : "Menu"} size={22} />
          </button>
        </div>

        {menuOpen && (
          <div className="md:hidden bg-background/95 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex flex-col gap-4">
            {NAV_LINKS.map(link => (
              <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}
                className="text-white/70 hover:text-white text-sm font-medium">{link.label}</a>
            ))}
          </div>
        )}
      </nav>

      {/* HERO */}
      <section id="home" className="relative min-h-screen flex items-center overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl animate-float"
            style={{ background: 'radial-gradient(circle, #FF6B35, transparent)' }} />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl animate-float"
            style={{ background: 'radial-gradient(circle, #A855F7, transparent)', animationDelay: '2s' }} />
          <div className="absolute top-1/2 right-1/3 w-64 h-64 rounded-full opacity-10 blur-3xl animate-float"
            style={{ background: 'radial-gradient(circle, #06B6D4, transparent)', animationDelay: '1s' }} />
          <div className="absolute inset-0 opacity-5"
            style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', backgroundSize: '80px 80px' }} />
          <div className="absolute top-20 right-20 w-32 h-32 rounded-full border border-white/5 animate-spin-slow" />
          <div className="absolute top-24 right-24 w-24 h-24 rounded-full border border-[#FF6B35]/10 animate-spin-slow" style={{ animationDirection: 'reverse', animationDuration: '15s' }} />
        </div>

        <div className="max-w-6xl mx-auto px-6 pt-24 pb-16">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 bg-white/5 text-xs text-white/60 font-medium mb-8 animate-fade-in opacity-0 delay-100">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-glow" />
              Открыт к новым проектам
            </div>

            <h1 className="font-display text-6xl md:text-8xl font-light leading-none mb-6 animate-slide-up opacity-0 delay-200">
              <span className="text-white">Алексей</span>
              <br />
              <span className="gradient-text italic">Морозов</span>
            </h1>

            <p className="text-xl md:text-2xl text-white/50 font-light leading-relaxed mb-4 animate-slide-up opacity-0 delay-300">
              Fullstack-разработчик
            </p>
            <p className="text-base text-white/35 leading-relaxed max-w-xl mb-10 animate-slide-up opacity-0 delay-400">
              Создаю цифровые продукты, которые решают реальные задачи бизнеса — от MVP до масштабируемых платформ
            </p>

            <div className="flex flex-wrap gap-4 animate-slide-up opacity-0 delay-500">
              <a href="#projects"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-black font-semibold text-sm transition-all duration-200 hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #FF6B35, #A855F7)', boxShadow: '0 0 30px rgba(255,107,53,0.3)' }}>
                Смотреть проекты
                <Icon name="ArrowRight" size={16} />
              </a>
              <a href="#skills"
                className="flex items-center gap-2 px-6 py-3 rounded-xl text-white font-semibold text-sm border border-white/10 bg-white/5 hover:bg-white/10 transition-all duration-200">
                Обо мне
              </a>
            </div>

            <div className="flex flex-wrap gap-8 mt-16 animate-fade-in opacity-0 delay-500">
              {[
                { value: "6+", label: "лет опыта" },
                { value: "40+", label: "проектов" },
                { value: "15+", label: "клиентов" },
              ].map(stat => (
                <div key={stat.label}>
                  <div className="text-3xl font-bold gradient-text">{stat.value}</div>
                  <div className="text-sm text-white/40 mt-1">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-float">
          <span className="text-xs text-white/30">Листай вниз</span>
          <Icon name="ChevronDown" size={16} className="text-white/20" />
        </div>
      </section>

      {/* MARQUEE */}
      <div className="py-6 border-y border-white/5 overflow-hidden">
        <div className="flex animate-marquee whitespace-nowrap">
          {[...TAGS_MARQUEE, ...TAGS_MARQUEE].map((tag, i) => (
            <span key={i} className="text-xs font-mono text-white/20 mx-6 uppercase tracking-widest">
              {tag} <span className="text-[#FF6B35]/40 mx-3">✦</span>
            </span>
          ))}
        </div>
      </div>

      {/* PROJECTS */}
      <section id="projects" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-mono text-[#FF6B35] uppercase tracking-widest mb-3">Портфолио</p>
            <h2 className="font-display text-5xl md:text-6xl font-light text-white">
              Избранные <span className="gradient-text italic">проекты</span>
            </h2>
            <p className="text-white/40 mt-4 max-w-xl">Реальные продукты с измеримыми результатами для бизнеса</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {PROJECTS.map((project, index) => (
              <ProjectCard key={project.id} project={project} index={index} />
            ))}
          </div>
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills" className="py-24">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-16">
            <p className="text-xs font-mono text-[#A855F7] uppercase tracking-widest mb-3">Обо мне</p>
            <h2 className="font-display text-5xl md:text-6xl font-light text-white">
              Навыки <span className="gradient-text italic">и опыт</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
            <div className="space-y-10">
              {[
                { label: "Frontend", skills: frontendSkills, color: "#FF6B35" },
                { label: "Backend", skills: backendSkills, color: "#A855F7" },
                { label: "DevOps", skills: devopsSkills, color: "#06B6D4" },
              ].map(group => (
                <div key={group.label}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md font-mono uppercase tracking-wider"
                      style={{ color: group.color, background: `${group.color}15` }}>
                      {group.label}
                    </span>
                  </div>
                  <div className="space-y-4">
                    {group.skills.map((skill, i) => (
                      <SkillBar key={skill.name} skill={skill} index={i} />
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h3 className="text-lg font-semibold text-white mb-8">Опыт работы</h3>
              <div className="space-y-0">
                {EXPERIENCE.map((exp, i) => (
                  <div key={i} className="relative pl-8 pb-10 last:pb-0">
                    <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full border-2 border-[#FF6B35] bg-background" />
                    {i < EXPERIENCE.length - 1 && (
                      <div className="absolute left-1.5 top-4 w-px h-full bg-gradient-to-b from-[#FF6B35]/30 to-transparent" />
                    )}
                    <p className="text-xs font-mono text-[#FF6B35]/70 mb-1">{exp.year}</p>
                    <h4 className="text-base font-semibold text-white">{exp.role}</h4>
                    <p className="text-sm font-medium mb-2" style={{ color: '#A855F7' }}>{exp.company}</p>
                    <p className="text-sm text-white/40 leading-relaxed">{exp.desc}</p>
                  </div>
                ))}
              </div>

              <div className="mt-10 p-6 rounded-xl gradient-border bg-card">
                <h4 className="text-base font-semibold text-white mb-3">Ищу проекты</h4>
                <p className="text-sm text-white/50 leading-relaxed mb-5">
                  Готов к фриланс-проектам, долгосрочному сотрудничеству или позиции в продуктовой команде.
                </p>
                <div className="flex flex-col gap-2">
                  {[
                    { icon: "Mail", label: "alex@portfolio.dev" },
                    { icon: "Github", label: "github.com/alexmorozov" },
                    { icon: "Linkedin", label: "linkedin.com/in/alexmorozov" },
                  ].map(contact => (
                    <div key={contact.icon} className="flex items-center gap-2 text-white/40 hover:text-white/70 cursor-pointer transition-colors">
                      <Icon name={contact.icon} size={14} />
                      <span className="font-mono text-xs">{contact.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="font-display italic text-lg gradient-text">Dev.Portfolio</span>
          <p className="text-xs text-white/25">© 2024 Алексей Морозов. Все права защищены.</p>
          <div className="flex items-center gap-4">
            {["Github", "Linkedin", "Mail"].map(icon => (
              <button key={icon} className="text-white/25 hover:text-white/60 transition-colors">
                <Icon name={icon} size={16} />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}