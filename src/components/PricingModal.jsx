import React from 'react'
import { X, Check, Zap, Shield, Users, Lock } from 'lucide-react'

const PricingModal = ({ isOpen, onClose, currentPlan = null }) => {
  if (!isOpen) return null

  const plans = [
    {
      id: 'starter',
      name: 'SecWeb3 Starter',
      description: 'Getting started for free',
      price: 0,
      period: 'month',
      yearlyPrice: 0,
      popular: false,
      features: [
        { icon: Zap, text: 'Starter Credits - 1000', included: true },
        { icon: Shield, text: 'Shared Analysis Engine', included: true },
        { icon: Users, text: 'Limited Scan Capacity', included: true },
        { icon: Lock, text: 'Public Sessions Only', included: true }
      ]
    },
    {
      id: 'pro',
      name: 'SecWeb3 Pro',
      description: 'Monthly credits, prioritized analysis and private sessions',
      price: 15,
      period: 'month',
      yearlyPrice: 180,
      popular: true,
      features: [
        { icon: Zap, text: '5000 Monthly Credits', included: true },
        { icon: Shield, text: 'Prioritized Scan Scheduling', included: true },
        { icon: Users, text: 'Amplified Analysis Capacity', included: true },
        { icon: Lock, text: 'Private Sessions', included: true }
      ]
    }
  ]

  const handleSubscribe = (planId) => {
    // TODO: Implement subscription logic
    console.log(`Subscribing to ${planId} plan`)
    // For now, just close the modal
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Choose Your Plan
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Unlock advanced features and get more credits
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Pricing Cards */}
        <div className="p-6">
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={`relative rounded-xl border-2 p-6 ${
                  plan.popular
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                } ${
                  currentPlan === plan.id ? 'ring-2 ring-green-500' : ''
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <span className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                      Most Popular
                    </span>
                  </div>
                )}

                {currentPlan === plan.id && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-green-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                      Current Plan
                    </span>
                  </div>
                )}

                <div className="text-center mb-6">
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {plan.name}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                    {plan.description}
                  </p>
                  
                  <div className="mb-4">
                    <div className="flex items-baseline justify-center">
                      <span className="text-4xl font-bold text-gray-900 dark:text-white">
                        US${plan.price}
                      </span>
                      <span className="text-gray-600 dark:text-gray-400 ml-2">
                        per {plan.period}
                      </span>
                    </div>
                    {plan.yearlyPrice !== plan.price * 12 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        US${plan.yearlyPrice} billed annually
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleSubscribe(plan.id)}
                    disabled={currentPlan === plan.id}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-200 ${
                      plan.popular
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl'
                        : currentPlan === plan.id
                        ? 'bg-green-100 text-green-800 border border-green-300 cursor-not-allowed'
                        : 'bg-gray-900 hover:bg-gray-800 text-white dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100'
                    }`}
                  >
                    {currentPlan === plan.id ? 'Current Plan' : 'Subscribe'}
                  </button>
                </div>

                <div className="space-y-3">
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">
                    This includes:
                  </p>
                  {plan.features.map((feature, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <div className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                        feature.included 
                          ? 'bg-green-100 dark:bg-green-900/30' 
                          : 'bg-gray-100 dark:bg-gray-700'
                      }`}>
                        <Check className={`h-3 w-3 ${
                          feature.included 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-gray-400'
                        }`} />
                      </div>
                      <span className={`text-sm ${
                        feature.included 
                          ? 'text-gray-900 dark:text-white' 
                          : 'text-gray-400 line-through'
                      }`}>
                        {feature.text}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Additional Info */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              All plans include 24/7 support and regular updates. Cancel anytime.
            </p>
            <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-500">
              <div className="flex items-center space-x-1">
                <Shield className="h-4 w-4" />
                <span>Secure Payment</span>
              </div>
              <div className="flex items-center space-x-1">
                <Lock className="h-4 w-4" />
                <span>SSL Encrypted</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PricingModal
