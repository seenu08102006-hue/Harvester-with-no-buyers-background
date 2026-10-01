import React, { useEffect, useState, useCallback } from 'react';
import {
  getBuyers, getAvailableHarvests, createBuyerRequest,
  getOrdersExtended, getNotifications, cancelOrder, cancelBuyerRequest
} from '../services/api';
import { useNavigate } from 'react-router-dom';
import { useWebSocket } from '../hooks/useWebSocket';
import LoadingSpinner from '../components/LoadingSpinner';
import TransportPanel from '../components/TransportPanel';
import NotificationsPanel from '../components/NotificationsPanel';
import OrderStatusTracker from '../components/OrderStatusTracker';
import {
  ShoppingCart, Search, Sprout, Truck, Bell, X, Check, AlertTriangle,
  LogOut, MapPin, Package, BarChart3, Clock, RefreshCw, ChevronRight,
  User, Phone, Shield, IndianRupee, Bot, Filter, Plus, Send, Loader, Ban
} from 'lucide-react';

export default function BuyerDashboard() {
  const [buyer, setBuyer] = useState(null);
  const [availableHarvests, setAvailableHarvests] = useState([]);
  const [myOrders, setMyOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [activeTab, setActiveTab] = useState('browse');
  const [searchQuery, setSearchQuery] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [selectedOrderId, setSelectedOrderId] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(null); // harvest object
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Cancellation modal state
  const [cancelModal, setCancelModal] = useState({
    open: false,
    orderId: null,
    title: '',
    reason: '',
    loading: false
  });


  // AI Assistant states for buyer
  const [showAIChat, setShowAIChat] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMatchOption, setAiMatchOption] = useState(null);
  const [aiMessages, setAiMessages] = useState([
    {
      role: 'ai',
      text: "👋 Hello! I'm your AI Procurement Assistant.\n\nTell me what produce and quantity you need — for example:\n• \"I want 500 Grade A tomatoes for tomorrow\"\n• \"Looking for 1000 Grade B produce\"\n\nI'll find the best matching farmer harvests and help you request them instantly!"
    }
  ]);

  const [requestForm, setRequestForm] = useState({
    quantity: '',
    quality_grade: 'A',
    delivery_date: new Date().toISOString().split('T')[0],
    delivery_location: '',
    message: '',
  });

  const navigate = useNavigate();

  const loadData = useCallback(async () => {
    try {
      const [bRes, hRes, oRes, nRes] = await Promise.allSettled([
        getBuyers(),
        getAvailableHarvests(),
        getOrdersExtended(),
        getNotifications('buyer'),
      ]);

      const savedUserStr = localStorage.getItem('user');
      let savedUser = null;
      try {
        savedUser = savedUserStr ? JSON.parse(savedUserStr) : null;
      } catch (e) {}

      let currentBuyer = null;
      if (bRes.status === 'fulfilled' && bRes.value.data?.length > 0) {
        if (savedUser?.username) {
          currentBuyer = bRes.value.data.find(
            b => b.username === savedUser.username || b.id === savedUser.buyer_id
          );
        }
        if (!currentBuyer) {
          currentBuyer = bRes.value.data[0];
        }
        setBuyer(currentBuyer);
      }

      if (hRes.status === 'fulfilled' && hRes.value.data) {
        setAvailableHarvests(hRes.value.data);
      }

      if (oRes.status === 'fulfilled' && oRes.value.data) {
        setMyOrders(oRes.value.data.filter(o => !currentBuyer || o.buyer_id === currentBuyer.id || o.buyer_name === currentBuyer.name));
      }

      if (nRes.status === 'fulfilled' && nRes.value.data) {
        setNotifications(nRes.value.data);
      }
    } catch (err) {
      console.error('Failed to load buyer data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // WebSocket real-time updates
  const handleWsEvent = useCallback((event, data) => {
    console.log('[WS Buyer]', event, data);
    if (event === 'harvest_created' || event === 'harvest_updated') {
      setSuccess(`🌾 Available harvests updated in real time!`);
      loadData();
    } else if (event === 'request_accepted' || event === 'order_accepted') {
      setSuccess(`✅ Your order #${data.order_id} was accepted by the farmer!`);
      loadData();
    } else if (event === 'order_cancelled') {
      setSuccess(`❌ Order #${data.order_id} was cancelled.`);
      loadData();
    } else if (event === 'harvest_cancelled') {
      loadData();
    } else if (event === 'transport_allocated') {
      setSuccess(`🚛 Transport assigned for Order #${data.order_id}!`);
      setSelectedOrderId(data.order_id);
      setActiveTab('orders');
      loadData();
    } else if (event === 'truck_status_updated' || event === 'order_status_updated') {
      setSuccess(`🚛 Live Transport Status: ${data.display_status || data.new_status || data.status}`);
      loadData();
    } else if (event === 'notification') {
      setNotifications(prev => [data, ...prev]);
    }
  }, [loadData]);

  useWebSocket('buyer', handleWsEvent);

  const handleCancelConfirm = async () => {
    if (!cancelModal.orderId) return;
    setCancelModal(prev => ({ ...prev, loading: true }));
    try {
      const res = await cancelOrder(cancelModal.orderId, {
        reason: cancelModal.reason || 'Buyer cancelled the order before pickup',
        cancelled_by: buyer?.username || 'buyer1',
        role: 'buyer',
      });
      setSuccess(res.data?.message || `Order #${cancelModal.orderId} cancelled and quantity released.`);
      setCancelModal({ open: false, orderId: null, title: '', reason: '', loading: false });
      await loadData();
    } catch (err) {
      console.error('Cancel order error:', err);
      setError(err.response?.data?.detail || 'Failed to cancel order.');
      setCancelModal(prev => ({ ...prev, loading: false }));
    }
  };

  useEffect(() => {
    if (success || error) {
      const t = setTimeout(() => { setSuccess(null); setError(null); }, 5000);
      return () => clearTimeout(t);
    }
  }, [success, error]);

  const handleRequestProduce = async (e) => {
    e.preventDefault();
    if (!showRequestForm) return;
    setSubmittingRequest(true);

    try {
      let activeBuyer = buyer;
      if (!activeBuyer) {
        const bRes = await getBuyers();
        if (bRes.data?.length > 0) {
          activeBuyer = bRes.data[0];
          setBuyer(activeBuyer);
        }
      }
      const buyerId = activeBuyer?.id || 1;

      await createBuyerRequest({
        buyer_id: buyerId,
        harvest_id: showRequestForm.id,
        quantity: parseFloat(requestForm.quantity),
        quality_grade: requestForm.quality_grade,
        delivery_date: requestForm.delivery_date,
        delivery_location: requestForm.delivery_location || activeBuyer?.location || 'Bangalore City',
        message: requestForm.message,
      });

      setShowRequestForm(null);
      setRequestForm({ quantity: '', quality_grade: 'A', delivery_date: new Date().toISOString().split('T')[0], delivery_location: '', message: '' });
      setSuccess('✅ Purchase request sent to farmer! They have been notified.');
      setActiveTab('orders');
      await loadData();
    } catch (e) {
      console.error('Request error:', e);
      setError(e.response?.data?.detail || e.message || 'Failed to send request.');
    } finally {
      setSubmittingRequest(false);
    }
  };

  // ── AI ASSISTANT FOR BUYER ──
  const handleAISend = async () => {
    if (!aiInput.trim()) return;
    const userMsg = aiInput.trim();
    setAiMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setAiInput('');
    setAiLoading(true);
    setAiMatchOption(null);

    await new Promise(r => setTimeout(r, 450));

    const lower = userMsg.toLowerCase();
    const qtyMatch = lower.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs|quintals?|tons?)/i) || lower.match(/(\d+)/);
    const gradeMatch = lower.match(/grade\s*([abc])/i) || lower.match(/\b([abc])\s*grade\b/i);
    const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 500;
    const grade = gradeMatch ? gradeMatch[1].toUpperCase() : 'A';

    // Find closest harvest in availableHarvests
    let matchedHarvest = availableHarvests.find(h => h.quality_grade === grade && (h.available_quantity || h.estimated_quantity) >= qty);
    if (!matchedHarvest && availableHarvests.length > 0) {
      matchedHarvest = availableHarvests.find(h => h.quality_grade === grade) || availableHarvests[0];
    }

    if (matchedHarvest) {
      const matchObj = {
        harvest: matchedHarvest,
        requested_qty: qty,
        grade: grade,
      };
      setAiMatchOption(matchObj);
      setAiMessages(prev => [...prev, {
        role: 'ai',
        text: `🎯 **Found Matching Supply!**\n\n• **Farmer:** ${matchedHarvest.farmer_name}\n• **Crop:** ${matchedHarvest.crop} (Grade ${matchedHarvest.quality_grade})\n• **Available:** ${matchedHarvest.available_quantity || matchedHarvest.estimated_quantity}\n• **Location:** ${matchedHarvest.farmer_location}\n• **Price:** ₹${matchedHarvest.expected_price || 25}\n\nWould you like to send a purchase request for **${qty}** to this farmer?`
      }]);
    } else {
      setAiMessages(prev => [...prev, {
        role: 'ai',
        text: `We currently have ${availableHarvests.length} active harvests listed. Tell me the quantity you need, for example:\n\n*"I want 500 Grade A tomatoes"*`
      }]);
    }
    setAiLoading(false);
  };

  const handleAIRequestConfirm = async () => {
    if (!aiMatchOption) return;
    try {
      const activeBuyerId = buyer?.id || 1;
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const deliveryDate = tomorrow.toISOString().split('T')[0];

      await createBuyerRequest({
        buyer_id: activeBuyerId,
        harvest_id: aiMatchOption.harvest.id,
        quantity: aiMatchOption.requested_qty,
        quality_grade: aiMatchOption.grade,
        delivery_date: deliveryDate,
        delivery_location: buyer?.location || 'Bangalore City',
        message: 'Requested via AI Procurement Assistant',
      });

      setAiMessages(prev => [...prev, {
        role: 'ai',
        text: `🎉 **Purchase request sent!** ${aiMatchOption.harvest.farmer_name} has received your request for **${aiMatchOption.requested_qty}**. Once they accept, our AI Transport Agent will automatically allocate optimal trucks!`
      }]);
      setAiMatchOption(null);
      setSuccess(`✅ Purchase request sent to ${aiMatchOption.harvest.farmer_name}!`);
      await loadData();
    } catch (err) {
      console.error('AI Request confirm error:', err);
      setAiMessages(prev => [...prev, {
        role: 'ai',
        text: `❌ Request could not be sent: ${err.response?.data?.detail || err.message || 'Please try again.'}`
      }]);
    }
  };

  const filteredHarvests = availableHarvests.filter(h => {
    const matchSearch = searchQuery === '' ||
      h.crop?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.farmer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.farmer_location?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchGrade = gradeFilter === 'all' || h.quality_grade === gradeFilter;
    return matchSearch && matchGrade;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;
  const gradeColor = { A: 'bg-primary-100 text-primary-700', B: 'bg-amber-100 text-amber-700', C: 'bg-stone-100 text-stone-600' };

  if (loading) return <LoadingSpinner message="Loading your dashboard..." />;

  return (
    <div className="min-h-screen bg-stone-50 font-sans" id="buyer-dashboard">

      {/* Topbar */}
      <div className="bg-white border-b border-stone-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-harvest-500 to-harvest-600 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-stone-900">HarvestFlow<span className="text-harvest-600">.ai</span></span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setActiveTab('notifications')} className="relative p-2 rounded-xl hover:bg-stone-100 transition-colors">
              <Bell className="w-5 h-5 text-stone-500" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">{unreadCount}</span>
              )}
            </button>
            <button onClick={() => setShowProfileModal(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-stone-100 transition-colors">
              <div className="w-8 h-8 rounded-full bg-harvest-100 flex items-center justify-center">
                <span className="font-bold text-harvest-700 text-sm">{buyer?.name?.charAt(0) || 'B'}</span>
              </div>
              <span className="text-sm font-semibold text-stone-700 hidden sm:block">{buyer?.name?.split('—')[0]?.trim() || 'Buyer'}</span>
            </button>
            <button onClick={() => navigate('/')} className="p-2 text-stone-400 hover:text-rose-500 transition-colors" title="Logout">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {success && <div className="mb-4 p-4 rounded-xl bg-harvest-50 border border-harvest-200 text-harvest-800 text-sm flex items-center gap-3 animate-slide-up"><Check className="w-4 h-4" />{success}</div>}
        {error && <div className="mb-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-center gap-3 animate-slide-up"><AlertTriangle className="w-4 h-4" />{error}</div>}

        {/* Hero */}
        <div className="bg-gradient-to-br from-stone-900 to-stone-800 rounded-2xl p-7 mb-6 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 opacity-5 pointer-events-none p-8">
            <ShoppingCart className="w-48 h-48" />
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
            <div>
              <p className="text-stone-400 text-sm mb-1">Welcome back,</p>
              <h1 className="font-bold text-2xl sm:text-3xl text-white">{buyer?.name || 'Buyer'}</h1>
              <div className="flex flex-wrap gap-4 mt-2 text-stone-300 text-sm">
                <span className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-harvest-400" />{buyer?.location || 'Bangalore'}</span>
                {myOrders.filter(o => o.status === 'transport_allocated').length > 0 && (
                  <span className="flex items-center gap-1.5 bg-violet-500/20 text-violet-300 px-2 py-0.5 rounded-full text-xs font-bold">
                    🚛 Transport assigned
                  </span>
                )}
              </div>
            </div>
            
            {/* AI Assistant + Browse Produce buttons */}
            <div className="flex items-center gap-3 flex-wrap">
              <button
                onClick={() => setShowAIChat(true)}
                className="flex items-center gap-2 px-5 py-3.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold transition-all shadow-lg shadow-violet-600/30 hover:-translate-y-0.5"
                title="Find and request produce with AI"
              >
                <Bot className="w-5 h-5 text-violet-200" /> AI Assistant
              </button>
              <button onClick={() => setActiveTab('browse')} className="flex items-center gap-2 px-6 py-3.5 rounded-xl bg-harvest-500 hover:bg-harvest-400 text-white font-bold transition-all shadow-lg shadow-harvest-500/30 hover:-translate-y-0.5">
                <Sprout className="w-5 h-5" /> Browse Produce
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            {[
              { label: 'Available Produce', value: availableHarvests.length, color: 'text-harvest-400' },
              { label: 'My Orders', value: myOrders.length, color: 'text-sky-400' },
              { label: 'Transport Assigned', value: myOrders.filter(o => o.status === 'transport_allocated').length, color: 'text-violet-400' },
              { label: 'Delivered', value: myOrders.filter(o => o.status === 'delivered').length, color: 'text-primary-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/10 rounded-xl p-3">
                <p className={`font-bold text-xl ${s.color}`}>{s.value}</p>
                <p className="text-stone-400 text-xs mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 mb-6 overflow-x-auto no-scrollbar">
          {[
            { key: 'browse', label: 'Available Produce', badge: availableHarvests.length },
            { key: 'orders', label: 'My Orders', badge: myOrders.filter(o => !['delivered','rejected'].includes(o.status)).length },
            { key: 'notifications', label: 'Notifications', badge: unreadCount },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${
                activeTab === t.key ? 'bg-stone-900 text-white shadow-md' : 'text-stone-500 hover:text-stone-700 hover:bg-stone-50'
              }`}
            >
              {t.label}
              {t.badge > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${activeTab === t.key ? 'bg-white text-stone-900' : 'bg-harvest-500 text-white'}`}>{t.badge}</span>}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">

            {/* ── BROWSE PRODUCE ── */}
            {activeTab === 'browse' && (
              <div className="space-y-4">
                {/* Search & Filter */}
                <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm flex flex-col sm:flex-row gap-3">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Search by crop, farmer, or location..."
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-harvest-500/30 focus:border-harvest-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    {['all', 'A', 'B', 'C'].map(g => (
                      <button
                        key={g}
                        onClick={() => setGradeFilter(g)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                          gradeFilter === g ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                        }`}
                      >
                        {g === 'all' ? 'All Grades' : `Grade ${g}`}
                      </button>
                    ))}
                    <button onClick={loadData} className="p-2 hover:bg-stone-100 rounded-xl transition-colors" title="Refresh">
                      <RefreshCw className="w-4 h-4 text-stone-400" />
                    </button>
                  </div>
                </div>

                {filteredHarvests.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400">
                    <Sprout className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No harvests match your criteria. Check back soon!</p>
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {filteredHarvests.map(h => (
                      <div key={h.id} className="bg-white rounded-2xl border border-stone-200 p-5 shadow-sm hover:shadow-md hover:border-stone-300 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <span className="font-bold text-lg text-stone-900">{h.crop}</span>
                            <p className="text-xs text-stone-500 flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3" /> {h.farmer_name}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${gradeColor[h.quality_grade] || 'bg-stone-100 text-stone-700'}`}>
                            Grade {h.quality_grade}
                          </span>
                        </div>

                        <div className="space-y-1.5 text-xs text-stone-600 mb-4 bg-stone-50 rounded-xl p-3">
                          <div className="flex justify-between">
                            <span className="text-stone-400">Available:</span>
                            <span className="font-bold text-stone-900">{h.available_quantity || h.estimated_quantity}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Location:</span>
                            <span className="font-medium text-stone-700">{h.farmer_location}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-stone-400">Available from:</span>
                            <span className="font-medium text-stone-700">{h.available_date || h.harvest_date}</span>
                          </div>
                          {h.expected_price && (
                            <div className="flex justify-between text-harvest-700 font-bold">
                              <span>Price:</span>
                              <span>₹{h.expected_price}</span>
                            </div>
                          )}
                        </div>

                        <button
                          onClick={() => {
                            setShowRequestForm(h);
                            setRequestForm(prev => ({
                              ...prev,
                              quality_grade: h.quality_grade,
                              quantity: Math.min(500, h.available_quantity || h.estimated_quantity).toString(),
                            }));
                          }}
                          className="w-full py-2.5 rounded-xl bg-harvest-600 hover:bg-harvest-700 text-white text-sm font-bold transition-colors shadow-sm flex items-center justify-center gap-1.5"
                        >
                          <ShoppingCart className="w-4 h-4" /> Request Produce
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── MY ORDERS ── */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {myOrders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center text-stone-400">
                    <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p>No orders yet. Browse available produce to send a request.</p>
                  </div>
                ) : (
                  myOrders.map(order => (
                    <div
                      key={order.id}
                      onClick={() => setSelectedOrderId(selectedOrderId === order.id ? null : order.id)}
                      className={`bg-white rounded-2xl border shadow-sm overflow-hidden cursor-pointer transition-all hover:shadow-md ${
                        order.status === 'cancelled' ? 'border-rose-200 bg-rose-50/20' :
                        selectedOrderId === order.id ? 'border-harvest-300 ring-2 ring-harvest-100' : 'border-stone-200'
                      }`}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-bold text-stone-900">Order #{order.id}</span>
                              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                                order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                order.status === 'transport_allocated' ? 'bg-violet-50 text-violet-700 border-violet-100' :
                                order.status === 'accepted' ? 'bg-primary-50 text-primary-700 border-primary-100' :
                                order.status === 'delivered' ? 'bg-stone-100 text-stone-600 border-stone-200' :
                                'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>{order.status?.replace('_', ' ')}</span>
                            </div>
                            <p className="text-sm text-stone-600">
                              {order.quantity} Grade {order.quality_grade} {order.crop} · From <span className="font-semibold">{order.farmer_name || 'Farmer'}</span>
                            </p>
                            {order.transport && order.status !== 'cancelled' && (
                              <p className="text-xs text-violet-600 font-semibold mt-1">
                                🚛 {order.transport.trucks_count} truck(s) assigned · Total freight: ₹{order.transport.total_cost?.toLocaleString()}
                              </p>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {['requested', 'accepted', 'transport_allocated', 'pending'].includes(order.status) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCancelModal({
                                    open: true,
                                    orderId: order.id,
                                    title: `Order #${order.order_code || order.id} (${order.quantity} Grade ${order.quality_grade} ${order.crop})`,
                                    reason: '',
                                    loading: false
                                  });
                                }}
                                className="px-3 py-1.5 rounded-xl border border-rose-200 bg-rose-50/50 text-rose-600 hover:bg-rose-100/70 text-xs font-bold flex items-center gap-1 transition-colors shadow-sm"
                                title="Cancel this order before transporter pickup"
                              >
                                <Ban className="w-3.5 h-3.5" /> Cancel Order
                              </button>
                            )}
                            <ChevronRight className={`w-5 h-5 text-stone-400 transition-transform ${selectedOrderId === order.id ? 'rotate-90' : ''}`} />
                          </div>
                        </div>

                        {/* Cancellation Info Banner */}
                        {order.status === 'cancelled' && (
                          <div className="mt-3 bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-800">
                            <p className="font-bold flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              Order Cancelled: {order.cancellation_reason || 'Cancelled before transporter pickup'}
                            </p>
                            <p className="text-[11px] text-rose-600 mt-0.5">
                              {order.cancelled_at ? `Cancelled at ${order.cancelled_at}` : ''} • Farmer inventory and transport capacity released.
                            </p>
                          </div>
                        )}

                        {/* Assigned Transporters and Truck Numbers */}
                        {order.transport?.trucks && order.transport.trucks.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-stone-100">
                            <p className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                              <Truck className="w-3.5 h-3.5 text-violet-600" />
                              Assigned Transporters & Trucks:
                            </p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {order.transport.trucks.map((truck, idx) => (
                                <div key={idx} className="bg-stone-50 border border-stone-200/80 rounded-xl p-2.5 flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center text-violet-700 font-bold text-xs flex-shrink-0">
                                      🚛
                                    </div>
                                    <div>
                                      <p className="font-bold text-stone-900 text-xs font-mono">{truck.vehicle_number}</p>
                                      <p className="text-[11px] text-stone-600 flex items-center gap-1">
                                        <User className="w-3 h-3 text-stone-400" /> {truck.driver_name || 'Transporter Fleet'}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 capitalize">
                                      {truck.status?.replace('_', ' ') || 'Assigned'}
                                    </span>
                                    {truck.driver_contact && (
                                      <p className="text-[10px] text-stone-400 mt-0.5 flex items-center justify-end gap-1">
                                        <Phone className="w-2.5 h-2.5" /> {truck.driver_contact}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedOrderId === order.id && (
                          <div className="mt-4">
                            <OrderStatusTracker status={order.status} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── NOTIFICATIONS ── */}
            {activeTab === 'notifications' && (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
                <h2 className="font-bold text-xl text-stone-900 mb-4">Notifications</h2>
                <NotificationsPanel
                  notifications={notifications}
                  onMarkRead={(id) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))}
                  maxShown={20}
                />
              </div>
            )}
          </div>

          {/* Right Column: Transport Panel */}
          <div className="lg:col-span-1">
            {selectedOrderId ? (
              <TransportPanel
                orderId={selectedOrderId}
                onStatusChange={loadData}
              />
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6 text-center text-stone-400">
                <Bot className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-semibold text-stone-700 mb-1">AI Transport Agent</p>
                <p className="text-xs text-stone-500">Select an order above to view real-time assigned trucks and logistics.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── REQUEST PRODUCE MODAL ── */}
      {showRequestForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={() => setShowRequestForm(null)}>
          <div className="bg-white rounded-2xl p-7 w-full max-w-md mx-4 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="font-bold text-xl text-stone-900">Request Produce</h2>
                <p className="text-sm text-stone-500 mt-0.5">
                  {showRequestForm.crop} · {showRequestForm.farmer_name}
                </p>
              </div>
              <button onClick={() => setShowRequestForm(null)} className="p-2 hover:bg-stone-100 rounded-xl"><X className="w-5 h-5 text-stone-500" /></button>
            </div>
            {/* Available info */}
            <div className="bg-stone-50 rounded-xl p-4 mb-5 text-sm grid grid-cols-2 gap-2">
              <div><p className="text-xs text-stone-400">Available</p><p className="font-bold text-stone-900">{showRequestForm.available_quantity || showRequestForm.estimated_quantity}</p></div>
              <div><p className="text-xs text-stone-400">Grade</p><span className={`text-xs font-bold px-2 py-0.5 rounded-full ${gradeColor[showRequestForm.quality_grade] || 'bg-stone-100 text-stone-700'}`}>Grade {showRequestForm.quality_grade}</span></div>
              <div><p className="text-xs text-stone-400">Location</p><p className="font-semibold text-stone-700">{showRequestForm.farmer_location}</p></div>
              {showRequestForm.expected_price && <div><p className="text-xs text-stone-400">Price</p><p className="font-bold text-stone-900">₹{showRequestForm.expected_price}</p></div>}
            </div>
            <form onSubmit={handleRequestProduce} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1.5">Quantity Required</label>
                  <input type="number" min="1" max={showRequestForm.available_quantity || showRequestForm.estimated_quantity} required
                    value={requestForm.quantity} onChange={e => setRequestForm({ ...requestForm, quantity: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-harvest-500/30 focus:border-harvest-500"
                    placeholder={`Max ${showRequestForm.available_quantity || showRequestForm.estimated_quantity}`} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-stone-700 mb-1.5">Quality Required</label>
                  <select value={requestForm.quality_grade} onChange={e => setRequestForm({ ...requestForm, quality_grade: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-harvest-500/30">
                    <option value="A">Grade A</option>
                    <option value="B">Grade B</option>
                    <option value="C">Grade C</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1.5">Delivery Date</label>
                <input type="date" required value={requestForm.delivery_date} onChange={e => setRequestForm({ ...requestForm, delivery_date: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-harvest-500/30" />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1.5">Delivery Location</label>
                <input type="text" value={requestForm.delivery_location} onChange={e => setRequestForm({ ...requestForm, delivery_location: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-harvest-500/30"
                  placeholder={buyer?.location || 'Bangalore City'} />
              </div>
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1.5">Message (optional)</label>
                <textarea rows={2} value={requestForm.message} onChange={e => setRequestForm({ ...requestForm, message: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-harvest-500/30 resize-none"
                  placeholder="Any special handling or packaging instructions..." />
              </div>
              {requestForm.quantity && (
                <div className="bg-harvest-50 rounded-xl p-3 text-sm text-harvest-800 flex justify-between">
                  <span>Estimated total value:</span>
                  <span className="font-bold">₹{((parseFloat(requestForm.quantity) || 0) * (showRequestForm.expected_price || 25)).toLocaleString()}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={submittingRequest}
                className="w-full py-3.5 rounded-xl bg-harvest-600 text-white font-bold hover:bg-harvest-700 transition-colors shadow-lg mt-2 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submittingRequest ? <Loader className="w-5 h-5 animate-spin" /> : <ShoppingCart className="w-5 h-5" />}
                {submittingRequest ? 'Sending Request...' : 'Send Purchase Request'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── AI CHAT PROCUREMENT MODAL ── */}
      {showAIChat && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 animate-fade-in" onClick={() => setShowAIChat(false)}>
          <div className="bg-white rounded-3xl w-full max-w-lg mx-4 mb-4 sm:mb-0 shadow-2xl animate-scale-in overflow-hidden flex flex-col" style={{ maxHeight: '85vh' }} onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-violet-600 to-violet-800 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                  <Bot className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="font-bold text-white text-lg">AI Procurement Assistant</h2>
                  <p className="text-violet-200 text-xs">Tell us what you want to buy in plain words</p>
                </div>
              </div>
              <button onClick={() => setShowAIChat(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
                <X className="w-5 h-5 text-white/70" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50" style={{ minHeight: '280px', maxHeight: '50vh' }}>
              {aiMessages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'ai' && (
                    <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                      <Bot className="w-4 h-4 text-violet-600" />
                    </div>
                  )}
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-line ${
                    msg.role === 'user'
                      ? 'bg-violet-600 text-white rounded-br-sm'
                      : 'bg-white text-stone-800 border border-stone-200 rounded-bl-sm shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="w-8 h-8 rounded-full bg-violet-100 flex items-center justify-center mr-2 flex-shrink-0">
                    <Bot className="w-4 h-4 text-violet-600" />
                  </div>
                  <div className="bg-white border border-stone-200 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center gap-2">
                    <Loader className="w-4 h-4 text-violet-500 animate-spin" />
                    <span className="text-stone-500 text-sm">Matching available harvests...</span>
                  </div>
                </div>
              )}
              {aiMatchOption && (
                <div className="flex justify-start pt-2">
                  <div className="w-8 h-8 mr-2 flex-shrink-0" />
                  <button
                    onClick={handleAIRequestConfirm}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-harvest-600 text-white text-sm font-bold hover:bg-harvest-700 transition-colors shadow-md hover:-translate-y-0.5"
                  >
                    <Check className="w-4 h-4" /> Send Request ({aiMatchOption.requested_qty})
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-stone-200 bg-white">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiInput}
                  onChange={e => setAiInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAISend()}
                  className="flex-1 px-4 py-3 rounded-xl border border-stone-200 focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 outline-none text-sm"
                  placeholder="e.g. I want 600 Grade A tomatoes for tomorrow..."
                />
                <button
                  onClick={handleAISend}
                  disabled={aiLoading || !aiInput.trim()}
                  className="w-12 h-12 rounded-xl bg-violet-600 text-white flex items-center justify-center hover:bg-violet-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                  title="Send message to AI"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── PROFILE MODAL ── */}
      {showProfileModal && buyer && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowProfileModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md mx-4 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-stone-900 to-stone-800 p-7">
              <button onClick={() => setShowProfileModal(false)} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-xl"><X className="w-5 h-5 text-white/60" /></button>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-harvest-500 flex items-center justify-center text-2xl font-bold text-white">{buyer.name.charAt(0)}</div>
                <div>
                  <h2 className="font-bold text-xl text-white">{buyer.name}</h2>
                  <p className="text-stone-400 text-sm">Buyer Account</p>
                </div>
              </div>
            </div>
            <div className="p-6 space-y-3">
              {[
                { label: 'Location', value: buyer.location, icon: MapPin },
                { label: 'Contact Person', value: buyer.contact || '—', icon: User },
                { label: 'Phone', value: buyer.phone ? `+91 ${buyer.phone}` : '—', icon: Phone },
                { label: 'Aadhaar', value: buyer.aadhaar_last4 ? `XXXX XXXX ${buyer.aadhaar_last4}` : '—', icon: Shield },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-3 p-3 rounded-xl bg-stone-50 border border-stone-100">
                  <div className="w-8 h-8 rounded-lg bg-stone-100 flex items-center justify-center flex-shrink-0">
                    <item.icon className="w-4 h-4 text-stone-600" />
                  </div>
                  <div>
                    <p className="text-xs text-stone-400 font-semibold uppercase tracking-wide">{item.label}</p>
                    <p className="text-sm font-bold text-stone-900">{item.value || '—'}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 pb-6">
              <button onClick={() => setShowProfileModal(false)} className="w-full py-3 rounded-xl bg-stone-900 text-white font-bold hover:bg-stone-800 transition-colors">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ── CANCELLATION CONFIRMATION MODAL ── */}
      {cancelModal.open && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in" onClick={() => !cancelModal.loading && setCancelModal({ ...cancelModal, open: false })}>
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl animate-scale-in" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
              <Ban className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-xl text-stone-900 mb-1">
              Cancel Order Request
            </h3>
            <p className="text-sm text-stone-500 mb-4">
              {cancelModal.title}
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 mb-4 text-xs text-amber-900">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                Inventory & Logistics Notice:
              </p>
              <ul className="list-disc pl-4 space-y-0.5 text-stone-600">
                <li>Reserved crop quantity will immediately be returned to the farmer.</li>
                <li>Any allocated transport trucks will be released for other deliveries.</li>
                <li>This cancellation will be logged in Admin History.</li>
              </ul>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                Cancellation Reason (Optional)
              </label>
              <input
                type="text"
                value={cancelModal.reason}
                onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}
                placeholder="e.g. Demand change, wrong quantity entered..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={cancelModal.loading}
                onClick={() => setCancelModal({ ...cancelModal, open: false })}
                className="flex-1 py-2.5 rounded-xl border border-stone-200 text-stone-700 font-bold text-sm hover:bg-stone-50 transition-colors"
              >
                Keep Order
              </button>
              <button
                type="button"
                disabled={cancelModal.loading}
                onClick={handleCancelConfirm}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {cancelModal.loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" /> Cancelling...
                  </>
                ) : (
                  'Confirm Cancel'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

