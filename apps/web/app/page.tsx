"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  MessageSquare,
  Bot,
  CheckCircle2,
  Users,
  BarChart3,
  Zap,
  Menu,
  X,
  ChevronDown,
  ArrowRight,
  ShieldCheck,
  Send,
  Sparkles,
  Check
} from "lucide-react";

// Custom SVG Icons for compatibility
function FacebookIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

function InstagramIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  );
}

// Types for Chat Simulator
interface Message {
  sender: "customer" | "bot" | "agent";
  text: string;
  time: string;
  isSlip?: boolean;
  slipStatus?: "verified" | "pending";
}

interface ChatSession {
  id: number;
  name: string;
  channel: "line" | "facebook" | "instagram" | "shopee" | "lazada";
  avatar: string;
  status: string;
  time: string;
  unreadCount: number;
  messages: Message[];
  aiSuggestion: string;
}

export default function HomePage() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isYearly, setIsYearly] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  // Chat Simulator State
  const [selectedChatId, setSelectedChatId] = useState(1);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([
    {
      id: 1,
      name: "คุณสิริพร (LINE OA)",
      channel: "line",
      avatar: "SL",
      status: "แนะนำชุดโปรโมชั่น...",
      time: "10:42",
      unreadCount: 1,
      messages: [
        { sender: "customer", text: "ต้องการเสื้อสีแดง ไซส์ L ค่ะ มีของพร้อมส่งไหมคะ?", time: "10:41" }
      ],
      aiSuggestion: "สวัสดีค่ะคุณสิริพร สีแดง ไซส์ L มีสินค้าพร้อมส่งค่ะ สนใจรับกี่ชุดดีคะ?"
    },
    {
      id: 2,
      name: "คุณสมชาย (Facebook)",
      channel: "facebook",
      avatar: "SC",
      status: "ตรวจสลิปเรียบร้อย ✅",
      time: "10:35",
      unreadCount: 0,
      messages: [
        { sender: "customer", text: "โอนเงินเรียบร้อยแล้วครับ ยอด 990 บาท", time: "10:32" },
        { sender: "customer", text: "สลิปโอนเงิน", time: "10:32", isSlip: true, slipStatus: "pending" }
      ],
      aiSuggestion: "ระบบได้ทำการทวนสอบสลิปเรียบร้อยแล้ว: ธนาคารกสิกรไทย ยอดเงิน 990.00 บาท วันเวลาถูกต้อง ✅ ออเดอร์ของคุณสมชายกำลังจัดเตรียมส่งค่ะ"
    },
    {
      id: 3,
      name: "คุณวิชัย (Instagram)",
      channel: "instagram",
      avatar: "WC",
      status: "สนใจระบบรายเดือน...",
      time: "10:15",
      unreadCount: 0,
      messages: [
        { sender: "customer", text: "สวัสดีครับ สนใจระบบแชทไวไปใช้กับร้านขายกระเป๋าครับ", time: "10:14" },
        { sender: "bot", text: "สวัสดีครับคุณวิชัย ยินดีให้บริการครับ! สนใจทดลองใช้งานฟรี 14 วัน หรือต้องการข้อมูลแพ็กเกจเพิ่มเติมดีครับ?", time: "10:15" }
      ],
      aiSuggestion: "สนใจรับลิงก์คู่มือเริ่มต้นใช้งาน หรือแนะนำแพ็กเกจที่เหมาะกับแบรนด์กระเป๋าของคุณวิชัยดีคะ?"
    }
  ]);

  const [isTyping, setIsTyping] = useState(false);

  const handleSendAiSuggestion = (chatId: number) => {
    const chat = chatSessions.find((c) => c.id === chatId);
    if (!chat || !chat.aiSuggestion) return;

    const updatedSessions = chatSessions.map((c) => {
      if (c.id === chatId) {
        const newMsg: Message = {
          sender: "bot",
          text: c.aiSuggestion,
          time: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })
        };
        
        let updatedMessages = [...c.messages, newMsg];
        
        if (chatId === 2) {
          updatedMessages = updatedMessages.map(m => {
            if (m.isSlip) {
              return { ...m, slipStatus: "verified" };
            }
            return m;
          });
        }

        return {
          ...c,
          messages: updatedMessages,
          unreadCount: 0,
          status: chatId === 2 ? "ตรวจสลิปเรียบร้อย ✅" : "AI ได้ช่วยตอบกลับแล้ว",
          aiSuggestion: ""
        };
      }
      return c;
    });

    setChatSessions(updatedSessions);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(true);
      const typingTimer = setTimeout(() => {
        setIsTyping(false);
      }, 2000);
      return () => clearTimeout(typingTimer);
    }, 4000);

    return () => clearTimeout(timer);
  }, [selectedChatId]);

  const activeChat = chatSessions.find((c) => c.id === selectedChatId) || chatSessions[0];

  const features = [
    {
      icon: MessageSquare,
      title: "กล่องข้อความรวม (Unified Inbox)",
      desc: "รวมทุกแชทจาก LINE OA, Facebook Messenger, Instagram, Shopee, Lazada ไว้ในหน้าต่างเดียว ประหยัดเวลา ไม่ต้องสลับแอปไปมา",
      color: "bg-indigo-50 text-indigo-600"
    },
    {
      icon: Bot,
      title: "ผู้ช่วยตอบแชท AI (AI Copilot)",
      desc: "ระบบวิเคราะห์ข้อมูลสินค้าและตอบกลับลูกค้าทันใจด้วยคำแนะนำจาก AI ช่วยลดภาระการพิมพ์ของแอดมิน และเพิ่มความพึงพอใจของลูกค้า",
      color: "bg-purple-50 text-purple-600"
    },
    {
      icon: CheckCircle2,
      title: "ตรวจจับสลิปโอนเงิน (Slip Verification)",
      desc: "วิเคราะห์และยืนยันสลิปโอนเงินธนาคารอัตโนมัติแบบ Real-time เช็คยอดเงินจริง วันเวลาโอน ป้องกันสลิปปลอมและการโกงได้ 100%",
      color: "bg-emerald-50 text-emerald-600"
    },
    {
      icon: Users,
      title: "ระบบจัดการข้อมูลลูกค้า (Customer CRM)",
      desc: "บันทึกประวัติพฤติกรรมลูกค้า จัดการแท็กแยกประเภท ติดตามขั้นตอนความคืบหน้าของออเดอร์ และสร้างฐานลูกค้าที่มีคุณภาพ",
      color: "bg-blue-50 text-blue-600"
    },
    {
      icon: Zap,
      title: "ระบบส่งข้อความโปรโมชั่น (Smart Broadcast)",
      desc: "บรอดแคสต์ส่งข้อความโปรโมชั่นหรืองานประกาศสำคัญตรงกลุ่มเป้าหมาย ส่งข้อมูลรวดเร็วพร้อมกันในทุกแพลตฟอร์มโซเชียลมีเดีย",
      color: "bg-amber-50 text-amber-600"
    },
    {
      icon: BarChart3,
      title: "สถิติและรายงานวิเคราะห์ (Analytics)",
      desc: "แดชบอร์ดรายงานผลเชิงลึก วิเคราะห์ปริมาณแชท ระยะเวลาการรอเฉลี่ย ประสิทธิภาพของแอดมิน และอัตราการปิดการขายเพื่อนำมาพัฒนาธุรกิจ",
      color: "bg-rose-50 text-rose-600"
    }
  ];

  const faqs = [
    {
      q: "ChatWai เชื่อมต่อช่องทางแชทใดได้บ้าง?",
      a: "ในปัจจุบัน ChatWai รองรับการเชื่อมต่อกับ LINE Official Account (LINE OA), Facebook Page, Instagram Direct Message, และร้านค้าบน Shopee / Lazada โดยทุกข้อความจะวิ่งตรงเข้ามายังหน้า Unified Inbox เดียวกันทันที"
    },
    {
      q: "ระบบการทวนสอบสลิป (Slip Verification) ทำงานอย่างไร?",
      a: "เมื่อลูกค้าส่งสลิปธนาคารเข้ามาในระบบผ่านช่องทางใดก็ตาม AI ของเราจะทำการวิเคราะห์ภาพ อ่านข้อมูลเลขที่บัญชี รหัสธุรกรรม ยอดโอน และวันเวลา จากนั้นเชื่อมต่อทวนสอบข้อมูลความถูกต้องกับธนาคารโดยตรงทันที ทำให้แอดมินทราบผลการโอนเงินที่แท้จริงภายใน 1 วินาที ปลอดภัยและแม่นยำสูง"
    },
    {
      q: "มีระยะเวลาทดลองใช้งานฟรีหรือไม่? และสามารถยกเลิกแพ็กเกจได้เมื่อใด?",
      a: "มีครับ เรายินดีให้คุณได้ทดลองใช้ระบบทุกฟีเจอร์อย่างเต็มรูปแบบฟรี 14 วัน โดยไม่จำเป็นต้องผูกบัตรเครดิตล่วงหน้า หากต้องการต่ออายุ สามารถเลือกจ่ายเป็นรายเดือนหรือรับส่วนลดพิเศษเมื่อชำระเป็นรายปี และคุณสามารถยกเลิกสัญญาบริการได้ทุกเมื่อตามที่ต้องการ"
    },
    {
      q: "ระบบความปลอดภัยของข้อมูลลูกค้าเป็นอย่างไร?",
      a: "ข้อมูลการสนทนา ประวัติลูกค้า และข้อมูลทางการเงินทั้งหมดจะถูกเข้ารหัสระดับสูงและเก็บรักษาอย่างปลอดภัยบนคลาวด์มาตรฐาน ISO โดยเราให้ความสำคัญสูงสุดกับกฎหมาย PDPA ของไทย เพื่อให้คุณทำธุรกิจได้อย่างมั่นใจไร้กังวล"
    }
  ];

  return (
    <div className="h-screen w-screen overflow-y-auto scroll-smooth bg-gradient-to-b from-[#F7F7FA] via-[#FCFCFD] to-[#EBEBFF] text-[#16182B] antialiased select-text">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 w-full border-b border-white/50 bg-white/70 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white shadow-md shadow-indigo-200">
              <MessageSquare className="h-5.5 w-5.5" />
            </div>
            <div>
              <span className="font-heading text-lg font-bold tracking-tight text-[#16182B]">ChatWai</span>
              <span className="ml-1 text-xs font-semibold text-white bg-[#4636D7] px-1.5 py-0.5 rounded">แชทไว</span>
            </div>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#767A8C]">
            <a href="#features" className="hover:text-[#4636D7] transition-colors">ฟีเจอร์เด่น</a>
            <a href="#channels" className="hover:text-[#4636D7] transition-colors">ช่องทางเชื่อมต่อ</a>
            <a href="#pricing" className="hover:text-[#4636D7] transition-colors">แพ็กเกจค่าบริการ</a>
            <a href="#faq" className="hover:text-[#4636D7] transition-colors">คำถามพบบ่อย</a>
          </nav>

          {/* Action Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link 
              href="/login" 
              className="px-4 py-2 text-sm font-semibold text-[#4636D7] hover:bg-slate-50 rounded-lg transition-all"
            >
              เข้าสู่ระบบ
            </Link>
            <Link 
              href="/login" 
              className="px-5 py-2.5 text-sm font-semibold text-white bg-[#4636D7] hover:bg-[#382BB5] rounded-xl shadow-lg shadow-indigo-150 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              เริ่มต้นใช้งานฟรี
            </Link>
          </div>

          {/* Mobile Menu Icon */}
          <button 
            type="button"
            className="md:hidden p-2 text-[#16182B] hover:bg-slate-100 rounded-lg"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Dropdown Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 bg-white/95 px-6 py-4 flex flex-col gap-4">
            <a 
              href="#features" 
              className="text-sm font-medium text-[#767A8C] hover:text-[#4636D7] py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              ฟีเจอร์เด่น
            </a>
            <a 
              href="#channels" 
              className="text-sm font-medium text-[#767A8C] hover:text-[#4636D7] py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              ช่องทางเชื่อมต่อ
            </a>
            <a 
              href="#pricing" 
              className="text-sm font-medium text-[#767A8C] hover:text-[#4636D7] py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              แพ็กเกจค่าบริการ
            </a>
            <a 
              href="#faq" 
              className="text-sm font-medium text-[#767A8C] hover:text-[#4636D7] py-2"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              คำถามพบบ่อย
            </a>
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              <Link 
                href="/login" 
                className="w-full py-3 text-center text-sm font-semibold text-[#4636D7] hover:bg-slate-50 rounded-xl border border-[#4636D7]/10"
              >
                เข้าสู่ระบบ
              </Link>
              <Link 
                href="/login" 
                className="w-full py-3 text-center text-sm font-semibold text-white bg-[#4636D7] hover:bg-[#382BB5] rounded-xl shadow-lg"
              >
                เริ่มต้นใช้งานฟรี
              </Link>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-24 md:pt-20 md:pb-32">
        <div className="absolute top-1/4 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 rounded-full bg-[#ECEBFF] opacity-70 blur-3xl" />
        <div className="absolute top-10 right-10 -z-10 h-96 w-96 rounded-full bg-blue-100/40 opacity-50 blur-3xl" />

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-12">
            
            {/* Hero Left */}
            <div className="lg:col-span-6 text-center lg:text-left flex flex-col justify-center">
              <div className="mx-auto lg:mx-0 mb-6 flex max-w-fit items-center gap-1.5 rounded-full bg-[#ECEBFF] px-4 py-1.5 text-xs font-semibold text-[#4636D7] ring-1 ring-[#4636D7]/10">
                <Sparkles size={14} />
                <span>เพิ่มแอดมิน AI ช่วยปิดยอดขายได้เร็วขึ้น 4 เท่า</span>
              </div>

              <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl md:text-6xl text-[#16182B]">
                รวมทุกแชทลูกค้าไว้ในที่เดียว ด้วยระบบ <span className="bg-gradient-to-r from-[#4636D7] to-[#8B5CF6] bg-clip-text text-transparent">AI อัจฉริยะ</span>
              </h1>
              
              <p className="mt-6 text-base md:text-lg leading-relaxed text-[#767A8C]">
                <strong>ChatWai (แชทไว)</strong> ช่วยเชื่อมต่อช่องทางสื่อสาร LINE OA, Facebook, IG, และมาร์เก็ตเพลสชั้นนำไว้ครบถ้วนในที่เดียว พร้อมระบบตรวจจับสลิปอัตโนมัติ AI ตอบด่วน และ CRM คัดแยกกลุ่มเป้าหมาย เพื่อผลลัพธ์ที่ดีที่สุดสำหรับธุรกิจยุคใหม่
              </p>

              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
                <Link 
                  href="/login" 
                  className="w-full sm:w-auto px-8 py-4 text-center text-base font-semibold text-white bg-[#4636D7] hover:bg-[#382BB5] rounded-2xl shadow-xl shadow-indigo-200 hover:-translate-y-0.5 transition-all"
                >
                  สมัครทดลองใช้ฟรี 14 วัน
                </Link>
                <a 
                  href="#features" 
                  className="w-full sm:w-auto px-8 py-4 text-center text-base font-semibold text-[#16182B] bg-white border border-[#DEDDE6] hover:bg-slate-50 rounded-2xl transition-all flex items-center justify-center gap-2"
                >
                  สำรวจฟีเจอร์เด่น
                  <ArrowRight size={16} />
                </a>
              </div>

              <div className="mt-8 flex items-center justify-center lg:justify-start gap-6 text-xs font-semibold text-[#767A8C]">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>ไม่ต้องผูกบัตรเครดิต</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-500" />
                  <span>ตั้งค่าเสร็จใน 5 นาที</span>
                </div>
              </div>
            </div>

            {/* Hero Right: Live Interactive Dashboard Widget Mockup */}
            <div className="lg:col-span-6">
              <div className="relative rounded-2xl border border-white/80 bg-white/45 p-4 shadow-2xl backdrop-blur-md ring-1 ring-black/5">
                <div className="absolute -top-3 -left-3 h-12 w-12 rounded-2xl bg-indigo-500/10 blur-xl" />
                <div className="absolute -bottom-3 -right-3 h-20 w-20 rounded-full bg-purple-500/10 blur-xl" />

                {/* Dashboard Frame Header */}
                <div className="flex items-center justify-between border-b border-slate-200/80 px-1 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full bg-[#DC4444]" />
                    <span className="h-3 w-3 rounded-full bg-[#D97706]" />
                    <span className="h-3 w-3 rounded-full bg-[#1F9D72]" />
                    <span className="ml-2 font-heading text-[10px] font-semibold text-[#767A8C] tracking-wide">CHATWAI LIVE INTERACTIVE DEMO</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[9px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                    <span className="h-1.5 w-1.5 animate-ping rounded-full bg-emerald-500" />
                    <span>ระบบจำลองเชื่อมต่อจริง</span>
                  </div>
                </div>

                {/* Main Widget Grid */}
                <div className="grid grid-cols-12 gap-3 pt-3">
                  {/* Left Column: Inbox List */}
                  <div className="col-span-5 border-r border-slate-200/50 pr-2">
                    <span className="text-[9px] font-bold text-[#767A8C] block mb-2 px-1">รายชื่อสนทนาลูกค้า</span>
                    <div className="flex flex-col gap-1.5">
                      {chatSessions.map((session) => {
                        const isSelected = session.id === selectedChatId;
                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => setSelectedChatId(session.id)}
                            className={`w-full text-left p-2 rounded-xl flex items-center justify-between transition-all ${
                              isSelected 
                                ? "bg-white shadow-md border border-slate-100 shadow-indigo-50/50 text-[#16182B]" 
                                : "hover:bg-white/60 text-[#767A8C] hover:text-[#16182B]"
                            }`}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className={`h-7 w-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                                session.channel === "line" 
                                  ? "bg-[#06C755] text-white" 
                                  : session.channel === "facebook" 
                                  ? "bg-blue-600 text-white" 
                                  : "bg-purple-600 text-white"
                              }`}>
                                {session.avatar}
                              </span>
                              <div className="min-w-0">
                                <p className="text-[10px] font-semibold truncate leading-tight">{session.name.split(" ")[0]}</p>
                                <p className="text-[8px] text-[#9A9DB0] truncate leading-none mt-0.5">{session.status}</p>
                              </div>
                            </div>
                            <span className="text-[8px] text-[#9A9DB0] shrink-0 font-medium">{session.time}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Right Column: Chat Window */}
                  <div className="col-span-7 flex flex-col h-[280px]">
                    <div className="border-b border-slate-200/50 pb-2 mb-2 flex items-center justify-between">
                      <div>
                        <span className="text-[11px] font-bold block">{activeChat.name}</span>
                        <span className="text-[8px] text-[#1F9D72] flex items-center gap-1 leading-none mt-0.5">
                          <span className="h-1 w-1 rounded-full bg-[#1F9D72]" /> Active Now
                        </span>
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 capitalize px-2 py-0.5 bg-slate-100 rounded">
                        {activeChat.channel}
                      </span>
                    </div>

                    {/* Messages Body */}
                    <div className="flex-1 overflow-y-auto px-1 flex flex-col gap-2.5">
                      {activeChat.messages.map((msg, index) => {
                        const isSelf = msg.sender === "bot" || msg.sender === "agent";
                        return (
                          <div 
                            key={`msg-${index}`} 
                            className={`flex flex-col max-w-[85%] ${isSelf ? "self-end items-end" : "self-start items-start"}`}
                          >
                            {msg.isSlip ? (
                              <div className="p-2 rounded-2xl bg-slate-50 border border-slate-200/80 shadow-sm flex flex-col gap-1.5">
                                <div className="flex items-center gap-2">
                                  <div className="h-7 w-7 bg-emerald-50 text-emerald-600 rounded-md flex items-center justify-center shrink-0">
                                    <CheckCircle2 size={14} />
                                  </div>
                                  <div className="leading-tight">
                                    <span className="text-[9px] font-bold block text-slate-600">KBANK_SLIP.PNG</span>
                                    <span className="text-[8px] text-slate-400">990.00 THB • 10:32</span>
                                  </div>
                                </div>
                                <div className={`text-[8px] font-bold py-1 px-2 rounded-lg text-center ${
                                  msg.slipStatus === "verified" 
                                    ? "bg-emerald-100 text-emerald-800" 
                                    : "bg-amber-100 text-amber-800 animate-pulse"
                                }`}>
                                  {msg.slipStatus === "verified" ? "✓ สลิปถูกต้องและอัปเดตยอดเรียบร้อย" : "⌛ กำลังตรวจสอบ..."}
                                </div>
                              </div>
                            ) : (
                              <div className={`p-2.5 rounded-2xl text-[10px] leading-relaxed ${
                                isSelf 
                                  ? "bg-[#4636D7] text-white rounded-tr-none" 
                                  : "bg-slate-100 text-[#16182B] rounded-tl-none"
                              }`}>
                                {msg.text}
                              </div>
                            )}
                            <span className="text-[7px] text-[#9A9DB0] mt-0.5">{msg.time}</span>
                          </div>
                        );
                      })}

                      {isTyping && (
                        <div className="self-start items-start max-w-[85%] flex flex-col">
                          <div className="bg-slate-100 text-[#767A8C] p-2 rounded-2xl rounded-tl-none text-[9px] flex items-center gap-1 shadow-sm">
                            <span className="animate-ping h-1 w-1 rounded-full bg-slate-400" />
                            <span>AI กำลังวิเคราะห์ข้อมูลและพิมพ์...</span>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* AI Suggestion Box */}
                    {activeChat.aiSuggestion && (
                      <div className="mt-2 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100 rounded-xl p-2 shadow-sm">
                        <div className="flex items-center gap-1 mb-1">
                          <Bot size={10} className="text-[#4636D7]" />
                          <span className="text-[8px] font-bold text-[#4636D7] tracking-wider uppercase">AI แนะนำการตอบกลับ</span>
                        </div>
                        <p className="text-[9px] text-[#767A8C] italic leading-tight">"{activeChat.aiSuggestion}"</p>
                        <button
                          type="button"
                          onClick={() => handleSendAiSuggestion(activeChat.id)}
                          className="mt-2 w-full py-1.5 bg-gradient-to-r from-[#4636D7] to-[#8B5CF6] hover:from-[#382BB5] hover:to-[#7c4df2] text-white text-[8px] font-bold rounded-lg flex items-center justify-center gap-1 transition-all"
                        >
                          <Send size={8} />
                          <span>ส่งคำตอบแนะนำนี้ (คลิกเพื่อทดสอบ)</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Supported Channels (Badges Section) */}
      <section id="channels" className="border-y border-slate-200/40 bg-white py-10 shadow-sm">
        <div className="mx-auto max-w-7xl px-6 text-center">
          <p className="text-[10px] font-bold text-[#767A8C] uppercase tracking-widest mb-6">
            เชื่อมต่อไร้รอยต่อกับทุกช่องทางการขายหลักของคุณ
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 md:gap-12 opacity-85">
            <div className="flex items-center gap-2 grayscale hover:grayscale-0 hover:scale-105 transition-all duration-300">
              <div className="h-8 w-8 bg-[#06C755] text-white rounded-lg flex items-center justify-center font-bold text-xs font-mono">L</div>
              <span className="font-heading text-sm font-semibold text-[#16182B]">LINE OA</span>
            </div>
            <div className="flex items-center gap-2 grayscale hover:grayscale-0 hover:scale-105 transition-all duration-300">
              <FacebookIcon className="h-8 w-8 text-[#1877F2]" />
              <span className="font-heading text-sm font-semibold text-[#16182B]">Facebook Messenger</span>
            </div>
            <div className="flex items-center gap-2 grayscale hover:grayscale-0 hover:scale-105 transition-all duration-300">
              <InstagramIcon className="h-8 w-8 text-[#E1306C]" />
              <span className="font-heading text-sm font-semibold text-[#16182B]">Instagram DM</span>
            </div>
            <div className="flex items-center gap-2 grayscale hover:grayscale-0 hover:scale-105 transition-all duration-300">
              <div className="h-8 w-8 bg-[#EE4D2D] text-white rounded-lg flex items-center justify-center font-extrabold text-xs">S</div>
              <span className="font-heading text-sm font-semibold text-[#16182B]">Shopee Chat</span>
            </div>
            <div className="flex items-center gap-2 grayscale hover:grayscale-0 hover:scale-105 transition-all duration-300">
              <div className="h-8 w-8 bg-[#10143B] text-white rounded-lg flex items-center justify-center font-extrabold text-xs">Lz</div>
              <span className="font-heading text-sm font-semibold text-[#16182B]">Lazada Chat</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-3xl mx-auto mb-16 md:mb-24">
            <h2 className="font-heading text-3xl font-extrabold sm:text-4xl text-[#16182B]">
              ฟีเจอร์เด่นที่สร้างขึ้นมาเพื่อเพิ่มยอดขายของธุรกิจไทย
            </h2>
            <p className="mt-4 text-base text-[#767A8C]">
              ลดขั้นตอนงานแอดมิน ป้องกันข้อผิดพลาด ยกระดับประสิทธิภาพการขายครบจบในหน้าจอเดียว
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => {
              const Icon = feature.icon;
              return (
                <div 
                  key={idx}
                  className="bg-white rounded-2xl p-8 border border-[#DEDDE6]/50 shadow-md shadow-indigo-50/20 hover:shadow-xl hover:shadow-indigo-100/30 transition-all hover:-translate-y-1 duration-300 flex flex-col items-start"
                >
                  <div className={`p-4 rounded-2xl ${feature.color} mb-6`}>
                    <Icon size={24} />
                  </div>
                  <h3 className="font-heading text-lg font-bold text-[#16182B] mb-3">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-[#767A8C]">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Sub Section: AI Focus Showcases */}
      <section className="bg-white/80 py-20 md:py-28 border-y border-slate-200/50 relative">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            {/* Left Col */}
            <div className="relative rounded-2xl bg-gradient-to-br from-[#4636D7]/5 to-[#8B5CF6]/5 border border-slate-200/60 p-8 flex items-center justify-center">
              <div className="absolute top-1/2 left-1/2 -z-10 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-100 blur-3xl opacity-60" />
              <div className="w-full max-w-md rounded-2xl border border-white bg-white p-6 shadow-xl shadow-slate-100">
                <div className="flex items-center gap-3 border-b border-slate-100 pb-4 mb-4">
                  <div className="h-8 w-8 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#16182B] block">ระบบตรวจสลิปและโอนยอดอัจฉริยะ</h4>
                    <span className="text-[9px] text-[#767A8C]">ทวนสอบสลิปผ่านธนาคารโดยตรง</span>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-[#767A8C]">ธนาคารผู้โอนเงิน:</span>
                    <span className="text-[10px] font-bold text-[#16182B]">ธนาคารกสิกรไทย (KBANK)</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-[#767A8C]">ยอดเงินและเวลาโอน:</span>
                    <span className="text-[10px] font-bold text-emerald-600">฿990.00 THB • 10:32 น.</span>
                  </div>
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-emerald-600" />
                    <span className="text-[10px] font-bold text-emerald-800">สถานะ: ตรวจสอบสำเร็จ ยอดเข้าบัญชีบริษัทเรียบร้อย</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Col */}
            <div className="flex flex-col justify-center">
              <h3 className="font-heading text-3xl font-extrabold text-[#16182B] mb-6">
                หมดปัญหาแอดมินจดออเดอร์พลาดและโดนโกงสลิป
              </h3>
              <p className="text-base text-[#767A8C] mb-8">
                ด้วยระบบการดึงสลิปโอนเงินมาอ่านอัตโนมัติและตรวจเช็คกับ API ของผู้ให้บริการทางการเงินของระบบธนาคารไทย คุณไม่จำเป็นต้องนั่งดูรายละเอียด วัน เวลา หรือกังวลกับแอปสลิปปลอมอีกต่อไป ปลอดภัยสูงสุด
              </p>
              
              <div className="flex flex-col gap-4">
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-1">
                    <Check size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#16182B]">ป้องกันการสลับสลิปซ้ำ</h4>
                    <p className="text-xs text-[#767A8C] mt-0.5">ระบบจะบันทึกเลขธุรกรรมและระงับการตรวจสอบสลิปเก่าที่เคยนำมาใช้แล้ว</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="h-6 w-6 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0 mt-1">
                    <Check size={14} />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-[#16182B]">อัปเดตสถานะคำสั่งซื้ออัตโนมัติ</h4>
                    <p className="text-xs text-[#767A8C] mt-0.5">เมื่อเช็คสลิปผ่าน ระบบสามารถเปลี่ยนสถานะพัสดุเป็น 'เตรียมจัดส่ง' ทันทีโดยไม่ต้องรอกดมือ</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-heading text-3xl font-extrabold sm:text-4xl text-[#16182B]">
              แผนบริการราคาคุ้มค่าสำหรับทุกขนาดธุรกิจ
            </h2>
            <p className="mt-4 text-base text-[#767A8C]">
              เริ่มต้นทดลองใช้งานฟรี 14 วัน ไม่ต้องใช้บัตรเครดิต ยกเลิกได้ตลอดเวลา
            </p>

            {/* Toggle Monthly / Yearly */}
            <div className="mt-8 flex items-center justify-center gap-4">
              <span className={`text-sm font-semibold ${!isYearly ? "text-[#4636D7]" : "text-[#767A8C]"}`}>รายเดือน</span>
              <button 
                type="button"
                onClick={() => setIsYearly(!isYearly)}
                className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-slate-200 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#4636D7] focus:ring-offset-2"
                style={{ backgroundColor: isYearly ? "#4636D7" : "#CBD5E1" }}
              >
                <span 
                  className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out"
                  style={{ transform: isYearly ? "translateX(20px)" : "translateX(0px)" }}
                />
              </button>
              <span className={`text-sm font-semibold flex items-center gap-1.5 ${isYearly ? "text-[#4636D7]" : "text-[#767A8C]"}`}>
                รายปี (ประหยัด 20%)
                <span className="text-[10px] text-white bg-rose-500 font-bold px-1.5 py-0.5 rounded-full">คุ้มค่าสุด!</span>
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">
            
            {/* Package 1: Starter */}
            <div className="bg-white rounded-2xl border border-[#DEDDE6]/50 p-8 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold text-[#16182B]">Starter</h3>
                <p className="text-xs text-[#767A8C] mt-2">เหมาะสำหรับผู้เริ่มต้นขายของออนไลน์คนเดียว</p>
                <div className="mt-6 flex items-baseline">
                  <span className="text-4xl font-extrabold text-[#16182B]">฿0</span>
                  <span className="text-xs text-[#767A8C] ml-2">/ ฟรีตลอดไป</span>
                </div>
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <span className="text-xs font-bold text-[#16182B] block mb-4 uppercase tracking-wider">ฟีเจอร์พื้นฐาน:</span>
                  <ul className="flex flex-col gap-3 text-xs text-[#767A8C]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>เชื่อมต่อได้ 1 ช่องทางสื่อสาร</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>แอดมินดูแลแชทได้สูงสุด 2 คน</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>รองรับ 2,000 ข้อความ/เดือน</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <X size={14} className="text-slate-300 shrink-0" />
                      <span className="line-through">ไม่มีระบบตรวจสลิปอัตโนมัติ</span>
                    </li>
                    <li className="flex items-center gap-2 text-slate-300">
                      <X size={14} className="text-slate-300 shrink-0" />
                      <span className="line-through">ไม่มีระบบผู้ช่วยแชท AI</span>
                    </li>
                  </ul>
                </div>
              </div>
              <Link 
                href="/login" 
                className="mt-8 w-full py-3.5 text-center text-sm font-semibold text-[#4636D7] border border-[#4636D7]/10 hover:bg-[#4636D7]/5 rounded-xl transition-all block"
              >
                เริ่มทดลองใช้งานฟรี
              </Link>
            </div>

            {/* Package 2: Pro (Recommended) */}
            <div className="bg-white rounded-2xl border-2 border-[#4636D7] p-8 shadow-xl shadow-indigo-100/50 relative flex flex-col justify-between">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-white bg-[#4636D7] px-4 py-1 rounded-full uppercase tracking-wider shadow-sm">
                ยอดนิยมและแนะนำ
              </span>
              <div>
                <h3 className="font-heading text-lg font-bold text-[#16182B]">Pro</h3>
                <p className="text-xs text-[#767A8C] mt-2">เหมาะสำหรับทีมขายระดับ SME ที่ต้องการขยายตัว</p>
                <div className="mt-6 flex items-baseline">
                  <span className="text-4xl font-extrabold text-[#16182B]">
                    {isYearly ? "฿790" : "฿990"}
                  </span>
                  <span className="text-xs text-[#767A8C] ml-2">/ เดือน</span>
                </div>
                {isYearly && <span className="text-[10px] text-rose-500 font-bold block mt-1">(ชำระเป็นรายปีประหยัดเงิน ฿2,400)</span>}
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <span className="text-xs font-bold text-[#16182B] block mb-4 uppercase tracking-wider">ครอบคลุมทุกฟีเจอร์:</span>
                  <ul className="flex flex-col gap-3 text-xs text-[#767A8C]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-[#16182B] font-medium">เชื่อมต่อทุกช่องทางแชทไม่จำกัด</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>แอดมินดูแลแชทได้สูงสุด 10 คน</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>รองรับ 50,000 ข้อความ/เดือน</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-[#16182B] font-medium">ระบบตรวจสลิปโอนเงิน (Slip Verification)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-[#16182B] font-medium">ระบบตอบกลับและเสนอข้อความโดย AI</span>
                    </li>
                  </ul>
                </div>
              </div>
              <Link 
                href="/login" 
                className="mt-8 w-full py-3.5 text-center text-sm font-semibold text-white bg-[#4636D7] hover:bg-[#382BB5] rounded-xl shadow-lg shadow-indigo-150 transition-all block"
              >
                เลือกสมัครแพ็กเกจ Pro
              </Link>
            </div>

            {/* Package 3: Enterprise */}
            <div className="bg-white rounded-2xl border border-[#DEDDE6]/50 p-8 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="font-heading text-lg font-bold text-[#16182B]">Enterprise</h3>
                <p className="text-xs text-[#767A8C] mt-2">สำหรับบริษัทขนาดใหญ่และองค์กรระดับ Enterprise</p>
                <div className="mt-6 flex items-baseline">
                  <span className="text-4xl font-extrabold text-[#16182B]">ติดต่อเรา</span>
                  <span className="text-xs text-[#767A8C] ml-2">/ รายเดือนแบบสั่งทำ</span>
                </div>
                <div className="mt-8 border-t border-slate-100 pt-6">
                  <span className="text-xs font-bold text-[#16182B] block mb-4 uppercase tracking-wider">การดูแลระดับองค์กร:</span>
                  <ul className="flex flex-col gap-3 text-xs text-[#767A8C]">
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>เชื่อมต่อครบถ้วน และรองรับการเชื่อม API เฉพาะ</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-[#16182B] font-medium">ไม่จำกัดจำนวนแอดมินดูแล</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>ไม่จำกัดจำนวนข้อความ/เดือน</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span className="text-[#16182B] font-medium">แอดมินและเซิร์ฟเวอร์ระบบคลาวด์แยกส่วนตัว</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check size={14} className="text-emerald-500 shrink-0" />
                      <span>รับประกันอัตรา uptime และบริการซัพพอร์ต 24/7</span>
                    </li>
                  </ul>
                </div>
              </div>
              <Link 
                href="/login" 
                className="mt-8 w-full py-3.5 text-center text-sm font-semibold text-[#16182B] border border-[#DEDDE6] hover:bg-slate-50 rounded-xl transition-all block"
              >
                ติดต่อฝ่ายขายของเรา
              </Link>
            </div>

          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faq" className="py-20 md:py-32 bg-white/50 border-t border-slate-200/50">
        <div className="mx-auto max-w-4xl px-6">
          <div className="text-center mb-16">
            <h2 className="font-heading text-3xl font-extrabold text-[#16182B]">
              คำถามที่พบบ่อย (FAQs)
            </h2>
            <p className="mt-4 text-base text-[#767A8C]">
              ไขข้อข้องใจทั้งหมดที่ลูกค้ามักสอบถามเกี่ยวกับระบบแชทไว
            </p>
          </div>

          <div className="flex flex-col gap-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index}
                  className="bg-white rounded-2xl border border-[#DEDDE6]/50 overflow-hidden transition-all shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : index)}
                    className="w-full px-6 py-5 text-left flex items-center justify-between gap-4"
                  >
                    <span className="font-heading text-base font-bold text-[#16182B]">{faq.q}</span>
                    <ChevronDown 
                      size={20} 
                      className={`text-[#767A8C] shrink-0 transition-transform duration-300 ${isOpen ? "rotate-180 text-[#4636D7]" : ""}`} 
                    />
                  </button>
                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-sm leading-relaxed text-[#767A8C] border-t border-slate-50">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Conversion Banner */}
      <section className="mx-auto max-w-7xl px-6 py-12 md:py-20">
        <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-[#4636D7] via-[#5D4FE2] to-[#8B5CF6] px-8 py-16 text-center text-white shadow-2xl">
          <div className="absolute top-0 right-0 h-48 w-48 bg-white/5 blur-2xl rounded-full" />
          <div className="absolute bottom-0 left-0 h-60 w-60 bg-white/5 blur-2xl rounded-full" />
          
          <h2 className="font-heading text-3xl font-extrabold sm:text-4xl md:text-5xl leading-tight">
            พร้อมที่จะยกระดับการจัดการแชทของร้านคุณแล้วหรือยัง?
          </h2>
          <p className="mt-4 text-base max-w-2xl mx-auto opacity-90">
            สมัครสมาชิกทดลองใช้งานระบบแชทไววันนี้ เพื่อเปลี่ยนทุกการแชทให้เป็นการขายที่รวดเร็วทันใจ ไร้การล่าช้า
          </p>
          
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 text-center text-base font-bold text-[#4636D7] bg-white hover:bg-slate-50 rounded-2xl shadow-xl transition-all hover:-translate-y-0.5"
            >
              เริ่มต้นใช้ฟรี 14 วัน
            </Link>
            <Link 
              href="/login" 
              className="w-full sm:w-auto px-8 py-4 text-center text-base font-bold text-white border border-white/30 hover:border-white/60 bg-white/10 hover:bg-white/20 rounded-2xl transition-all"
            >
              คุยกับทีมผู้เชี่ยวชาญ
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200/50 bg-white py-12 md:py-16 text-xs text-[#767A8C]">
        <div className="mx-auto max-w-7xl px-6 grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2 flex flex-col gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#4636D7] to-[#8B5CF6] text-white">
                <MessageSquare size={16} />
              </div>
              <span className="font-heading text-sm font-bold text-[#16182B]">ChatWai</span>
              <span className="text-[9px] font-bold text-white bg-[#4636D7] px-1.5 py-0.5 rounded">แชทไว</span>
            </div>
            <p className="text-xs leading-relaxed max-w-sm">
              ระบบศูนย์กลางตอบรับแชทลูกค้า คัดแยกสถานะ ตรวจสลิปยอดอัตโนมัติ และตอบแชทด้วย AI สมบูรณ์แบบที่เกิดมาเพื่อธุรกิจและร้านค้าออนไลน์ไทยอย่างแท้จริง
            </p>
            <p className="mt-4">
              © {new Date().getFullYear()} ChatWai. All rights reserved.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-bold text-[#16182B] uppercase tracking-wider text-[10px]">เมนูบริการ</span>
            <a href="#features" className="hover:text-[#4636D7]">ฟีเจอร์เด่น</a>
            <a href="#channels" className="hover:text-[#4636D7]">ช่องทางเชื่อมต่อ</a>
            <a href="#pricing" className="hover:text-[#4636D7]">แพ็กเกจค่าบริการ</a>
            <Link href="/login" className="hover:text-[#4636D7]">สมัครใช้งาน</Link>
          </div>

          <div className="flex flex-col gap-3">
            <span className="font-bold text-[#16182B] uppercase tracking-wider text-[10px]">ความปลอดภัย</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>PDPA Compliant</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>SSL Secure 256-bit</span>
            </span>
            <a href="#" className="hover:text-[#4636D7] mt-1">ข้อตกลงความเป็นส่วนตัว</a>
            <a href="#" className="hover:text-[#4636D7]">เงื่อนไขการใช้บริการ</a>
          </div>
        </div>
      </footer>

    </div>
  );
}
