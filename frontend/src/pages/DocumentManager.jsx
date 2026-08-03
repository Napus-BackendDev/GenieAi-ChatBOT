import { useCallback, useEffect, useState } from 'react';
import { FileText, Save, Trash2, Upload, Plus, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, Button, Input } from '@heroui/react';
import { TableSkeleton } from '../components/SkeletonLoader';

const DocumentManager = ({ tenantId, triggerReupload }) => {
  const [profile, setProfile] = useState({
    company_name: '',
    business_hours: '',
    services: [],
    contact_number: ''
  });
  
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [activeSubTab, setActiveSubTab] = useState('profile');

  const fetchProfileAndDocs = useCallback(async () => {
    try {
      setLoading(true);
      const profileRes = await fetch(`/api/tenant/profile/${tenantId}`);
      const profileData = await profileRes.json();
      setProfile(profileData);

      const docsRes = await fetch(`/api/documents?tenant_id=${tenantId}`);
      const docsData = await docsRes.json();
      setDocuments(docsData);
    } catch (e) {
      console.error("Failed to load document manager data:", e);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchProfileAndDocs();
  }, [fetchProfileAndDocs]);

  const handleProfileSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      const response = await fetch(`/api/tenant/profile/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      }

      setMessage({ type: 'success', text: 'บันทึกข้อมูลและอัปเดตระบบ AI สำเร็จเรียบร้อยแล้ว!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleServiceChange = (idx, field, val) => {
    const updatedServices = [...profile.services];
    updatedServices[idx][field] = field === 'price' || field === 'duration' ? Number(val) : val;
    setProfile({ ...profile, services: updatedServices });
  };

  const addServiceRow = () => {
    setProfile({
      ...profile,
      services: [...profile.services, { name: '', price: 0, duration: 30 }]
    });
  };

  const removeServiceRow = (idx) => {
    setProfile({
      ...profile,
      services: profile.services.filter((_, i) => i !== idx)
    });
  };

  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('คุณต้องการลบเอกสารคู่มือความรู้นี้ออกจากระบบ RAG/CAG จริงหรือไม่? ข้อมูลประมวลผลข้อความจะถูกเคลียร์ทั้งหมด.')) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${docId}?tenant_id=${tenantId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || 'เกิดข้อผิดพลาดในการลบเอกสาร');
      }

      fetchProfileAndDocs();
      setMessage({ type: 'success', text: 'ลบเอกสารและเคลียร์คลังความรู้ AI สำเร็จแล้ว!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const formatDate = (isoStr) => {
    try {
      const dt = new Date(isoStr);
      return dt.toLocaleDateString('th-TH', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) + ' น.';
    } catch {
      return isoStr;
    }
  };

  if (loading) {
    return <TableSkeleton />;
  }

  return (
    <div className="animate-fade-in text-left">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-extrabold text-[#1A365D] dark:text-white">
            จัดการความรู้และบริการของร้าน
          </h1>
          <p className="text-sm text-default-400 mt-1">คุณสามารถจัดการกฎเกณฑ์ของ AI, รายการราคาบริการ และลบไฟล์เอกสาร RAG/CAG ได้จากหน้านี้</p>
        </div>
        <Button 
          onClick={triggerReupload} 
          className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all duration-300 gap-2 font-semibold rounded-xl h-11 cursor-pointer"
        >
          <Upload size={16} />
          อัปโหลดไฟล์คู่มือใหม่
        </Button>
      </div>

      {/* Sub Tabs Toggle */}
      <div className="mb-6 w-full flex bg-slate-900/60 dark:bg-black/40 border border-white/5 p-1 rounded-xl max-w-md">
        <button
          type="button"
          onClick={() => { setActiveSubTab('profile'); setMessage({ type: '', text: '' }); }}
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all duration-300 relative cursor-pointer ${
            activeSubTab === 'profile'
              ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md'
              : 'text-default-400 hover:text-foreground'
          }`}
        >
          แก้ไขบริการและข้อมูลหลัก
        </button>
        <button
          type="button"
          onClick={() => { setActiveSubTab('files'); setMessage({ type: '', text: '' }); }}
          className={`flex-1 py-2.5 text-center text-sm font-semibold rounded-lg transition-all duration-300 relative cursor-pointer ${
            activeSubTab === 'files'
              ? 'bg-gradient-to-r from-cyan-500 to-indigo-500 text-white shadow-md'
              : 'text-default-400 hover:text-foreground'
          }`}
        >
          {`เอกสารที่อัปโหลดไว้ (${documents.length})`}
        </button>
      </div>

      {message.text && (
        <div className={`p-4 rounded-xl text-sm border flex items-center gap-2 mb-6 ${
          message.type === 'success' 
            ? 'bg-success/10 border-success/20 text-success' 
            : 'bg-danger/10 border-danger/20 text-danger'
        }`}>
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {message.text}
        </div>
      )}

      {activeSubTab === 'profile' && (
        <Card className="glass-panel border-white/5 shadow-md p-8 rounded-2xl">
          <CardContent className="p-0">
            <form onSubmit={handleProfileSave} className="flex flex-col gap-6">
              {/* General Fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <label className="text-sm font-semibold text-foreground">ชื่อบริษัท / ร้านค้าอย่างเป็นทางการ <span className="text-danger">*</span></label>
                  <Input
                    type="text"
                    value={profile.company_name}
                    onChange={(e) => setProfile({ ...profile, company_name: e.target.value })}
                    required
                    className="w-full text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <label className="text-sm font-semibold text-foreground">เบอร์โทรศัพท์ร้านค้า</label>
                  <Input
                    type="text"
                    value={profile.contact_number}
                    onChange={(e) => setProfile({ ...profile, contact_number: e.target.value })}
                    className="w-full text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <label className="text-sm font-semibold text-foreground">เวลาเปิดทำการของร้าน</label>
                  <Input
                    type="text"
                    value={profile.business_hours}
                    placeholder="เช่น เปิดทุกวัน 09:00 - 20:00 น."
                    onChange={(e) => setProfile({ ...profile, business_hours: e.target.value })}
                    className="w-full text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                  />
                </div>
                <div className="flex flex-col gap-1.5 w-full text-left">
                  <label className="text-sm font-semibold text-foreground">URL โดเมนสำหรับ Webhook (เช่น Nginx / Ngrok)</label>
                  <Input
                    type="text"
                    value={profile.webhook_domain || ''}
                    placeholder="เช่น https://your-nginx-domain.com หรือ https://xxx.ngrok-free.app"
                    onChange={(e) => setProfile({ ...profile, webhook_domain: e.target.value })}
                    className="w-full text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                  />
                </div>
              </div>

              {/* Services Section */}
              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-base font-semibold text-foreground">รายการบริการและราคา (Services List)</h3>
                  <Button 
                    type="button" 
                    onClick={addServiceRow} 
                    variant="bordered" 
                    size="sm" 
                    className="border-white/10 hover:bg-white/5 text-foreground rounded-xl cursor-pointer font-medium h-9"
                  >
                    <Plus size={14} />
                    เพิ่มบริการ
                  </Button>
                </div>

                <div className="glass-panel border-white/5 rounded-xl overflow-hidden p-4 flex flex-col gap-4">
                  {profile.services.length === 0 ? (
                    <div className="py-6 text-center text-default-400 text-sm">
                      ยังไม่มีรายการบริการในคลังข้อมูลแอดมิน
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {profile.services.map((service, idx) => (
                        <div key={idx} className="flex flex-col md:flex-row items-center gap-4 w-full">
                          <Input
                            type="text"
                            placeholder="ชื่อบริการ (เช่น ตัดผมชาย)"
                            value={service.name}
                            onChange={(e) => handleServiceChange(idx, 'name', e.target.value)}
                            required
                            className="flex-1 text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                          />
                          <Input
                            type="number"
                            placeholder="ราคา (บาท)"
                            value={service.price}
                            onChange={(e) => handleServiceChange(idx, 'price', e.target.value)}
                            required
                            className="w-full md:w-36 text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                          />
                          <Input
                            type="number"
                            placeholder="ระยะเวลา (นาที)"
                            value={service.duration}
                            onChange={(e) => handleServiceChange(idx, 'duration', e.target.value)}
                            required
                            className="w-full md:w-36 text-foreground bg-slate-900/60 dark:bg-black/40 border border-white/5 rounded-xl h-11 focus:border-cyan-500/40 transition-colors"
                          />
                          <Button
                            type="button"
                            onClick={() => removeServiceRow(idx)}
                            isIconOnly
                            variant="light"
                            color="danger"
                            radius="lg"
                            className="w-12 h-11 border border-danger/10 hover:bg-danger/10 rounded-xl cursor-pointer"
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <Button 
                type="submit" 
                color="primary" 
                isLoading={saving}
                className="bg-gradient-to-r from-cyan-500 to-indigo-500 hover:from-cyan-400 hover:to-indigo-400 text-white shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all duration-300 w-48 font-semibold h-12 rounded-xl mt-4 cursor-pointer"
              >
                {!saving && <Save size={16} />}
                บันทึกการตั้งค่า
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {activeSubTab === 'files' && (
        <Card className="glass-panel border-white/5 shadow-md p-8 rounded-2xl">
          <CardContent className="p-0">
            <h3 className="text-lg font-semibold text-foreground pb-3 mb-5 border-b border-white/5">
              คลังเอกสารอ้างอิงของระบบ RAG/CAG
            </h3>

            {documents.length === 0 ? (
              <div className="py-12 text-center flex flex-col items-center gap-4">
                <p className="text-default-400 text-sm">ยังไม่มีคู่มือเอกสารอัปโหลดเข้าสู่คลังความรู้</p>
                <Button 
                  onClick={triggerReupload} 
                  className="bg-gradient-to-r from-cyan-500 to-indigo-500 text-white rounded-xl font-semibold cursor-pointer shadow-md shadow-cyan-500/20 hover:scale-[1.02] transition-all duration-300"
                >
                  <Upload size={16} className="mr-2" />
                  อัปโหลดเอกสารชิ้นแรก
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {documents.map((doc) => (
                  <div
                    key={doc.document_id}
                    className="glass-panel hover-scale hover:border-cyan-500/20 flex justify-between items-center p-4 rounded-xl transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-cyan-400 to-indigo-500 text-white rounded-xl w-11 h-11 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                        <FileText size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-foreground">
                          {doc.document_name}
                        </h4>
                        <p className="text-xs text-default-400 mt-1">
                          จำนวน: <span className="text-cyan-400 font-semibold">{doc.page_count}</span> หน้า • อัปโหลดเมื่อ: <span className="opacity-80">{formatDate(doc.uploaded_at)}</span>
                        </p>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleDeleteDocument(doc.document_id)}
                      isIconOnly
                      variant="light"
                      color="danger"
                      className="border border-danger/10 hover:bg-danger/10 rounded-xl cursor-pointer hover:scale-105 transition-all duration-300"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DocumentManager;
