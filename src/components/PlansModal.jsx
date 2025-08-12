import React, { useState, useEffect } from 'react';
import { X, Check, Star, Zap, Shield, Users, Phone, Mail, Building } from 'lucide-react';

const PlansModal = ({ isOpen, onClose, currentUser, onUpgradeRequest }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [showUpgradeForm, setShowUpgradeForm] = useState(false);
  const [upgradeForm, setUpgradeForm] = useState({
    companyName: '',
    contactEmail: currentUser?.walletAddress || '',
    contactPhone: '',
    useCase: '',
    expectedMonthlyScans: '',
    specialRequirements: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen]);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/plans');
      const data = await response.json();
      setPlans(data.plans || []);
    } catch (error) {
      console.error('Failed to fetch plans:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgradeClick = (plan) => {
    setSelectedPlan(plan);
    setShowUpgradeForm(true);
  };

  const handleUpgradeSubmit = async (e) => {
    e.preventDefault();

    if (!upgradeForm.contactEmail || !upgradeForm.useCase) {
      alert('Please fill in all required fields');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/plans/upgrade-request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          requestedPlanCode: selectedPlan.code,
          ...upgradeForm
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Upgrade request submitted! We will contact you within 24 hours.');
        onUpgradeRequest?.(data);
        setShowUpgradeForm(false);
        onClose();
      } else {
        alert(data.error || 'Failed to submit upgrade request');
      }
    } catch (error) {
      console.error('Upgrade request error:', error);
      alert('Failed to submit upgrade request');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const getPlanIcon = (code) => {
    switch (code) {
      case 'free': return <Shield className="w-8 h-8" />;
      case 'pro': return <Zap className="w-8 h-8" />;
      case 'custom': return <Star className="w-8 h-8" />;
      default: return <Shield className="w-8 h-8" />;
    }
  };

  const getPlanColor = (code) => {
    switch (code) {
      case 'free': return 'border-gray-200 bg-gray-50';
      case 'pro': return 'border-blue-200 bg-blue-50 ring-2 ring-blue-500';
      case 'custom': return 'border-purple-200 bg-purple-50';
      default: return 'border-gray-200 bg-gray-50';
    }
  };

  if (showUpgradeForm && selectedPlan) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
            <div className="flex items-center space-x-3">
              <div className="text-blue-600">{getPlanIcon(selectedPlan.code)}</div>
              <div>
                <h3 className="text-xl font-semibold">Upgrade to {selectedPlan.name}</h3>
                <p className="text-sm text-gray-600">We'll contact you within 24 hours</p>
              </div>
            </div>
            <button onClick={() => setShowUpgradeForm(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleUpgradeSubmit} className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Building className="w-4 h-4 inline mr-1" />
                  Company Name
                </label>
                <input
                  type="text"
                  value={upgradeForm.companyName}
                  onChange={(e) => setUpgradeForm(prev => ({ ...prev, companyName: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your company name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="w-4 h-4 inline mr-1" />
                  Contact Email *
                </label>
                <input
                  type="email"
                  required
                  value={upgradeForm.contactEmail}
                  onChange={(e) => setUpgradeForm(prev => ({ ...prev, contactEmail: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={upgradeForm.contactPhone}
                  onChange={(e) => setUpgradeForm(prev => ({ ...prev, contactPhone: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expected Monthly Scans
                </label>
                <input
                  type="number"
                  value={upgradeForm.expectedMonthlyScans}
                  onChange={(e) => setUpgradeForm(prev => ({ ...prev, expectedMonthlyScans: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., 50"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Use Case Description *
              </label>
              <textarea
                required
                value={upgradeForm.useCase}
                onChange={(e) => setUpgradeForm(prev => ({ ...prev, useCase: e.target.value }))}
                rows={4}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Describe how you plan to use our smart contract auditing service..."
              />
            </div>

            {selectedPlan.code === 'custom' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requirements
                </label>
                <textarea
                  value={upgradeForm.specialRequirements}
                  onChange={(e) => setUpgradeForm(prev => ({ ...prev, specialRequirements: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="API access, white-labeling, custom integrations, higher limits, etc."
                />
              </div>
            )}

            <div className="flex space-x-4">
              <button
                type="button"
                onClick={() => setShowUpgradeForm(false)}
                className="flex-1 py-3 px-4 border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-3 px-4 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {loading ? 'Submitting...' : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold">Choose Your Plan</h2>
            <p className="text-gray-600">Scale your smart contract security analysis</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.code}
                  className={`relative rounded-2xl border-2 p-6 ${getPlanColor(plan.code)}`}
                >
                  {plan.code === 'pro' && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <span className="bg-blue-600 text-white px-3 py-1 text-sm font-medium rounded-full">
                        Most Popular
                      </span>
                    </div>
                  )}

                  <div className="text-center mb-6">
                    <div className="text-blue-600 flex justify-center mb-3">
                      {getPlanIcon(plan.code)}
                    </div>
                    <h3 className="text-xl font-bold">{plan.name}</h3>
                    <p className="text-gray-600 text-sm mt-1">{plan.description}</p>
                    <div className="mt-4">
                      <span className="text-3xl font-bold">
                        {plan.price_cents === 0 ? 'Free' : `$${plan.price_cents / 100}`}
                      </span>
                      {plan.price_cents > 0 && <span className="text-gray-600">/month</span>}
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Credits per month</span>
                      <span className="font-semibold">{plan.credits_per_month.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Credits per scan</span>
                      <span className="font-semibold">Up to {plan.credits_per_scan_limit}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">Files per scan</span>
                      <span className="font-semibold">{plan.files_per_scan_limit} files</span>
                    </div>
                  </div>

                  <div className="space-y-3 mb-6">
                    {plan.features.map((feature, index) => (
                      <div key={index} className="flex items-start space-x-2">
                        <Check className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => handleUpgradeClick(plan)}
                    disabled={currentUser?.plan?.code === plan.code}
                    className={`w-full py-3 px-4 rounded-xl font-medium transition-colors ${
                      currentUser?.plan?.code === plan.code
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                        : plan.code === 'pro'
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {currentUser?.plan?.code === plan.code
                      ? 'Current Plan'
                      : plan.code === 'free'
                      ? 'Downgrade'
                      : 'Request Upgrade'
                    }
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlansModal;
