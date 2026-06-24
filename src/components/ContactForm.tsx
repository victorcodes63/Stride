'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import { Send, AlertCircle, CheckCircle } from 'lucide-react';
import { ContactFormData } from '@/types';
import { useIsDesktop } from '@/hooks/useIsDesktop';

const ContactForm = () => {
  const isDesktop = useIsDesktop();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<ContactFormData>();

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        setSubmitStatus('success');
        reset();
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="bg-white rounded-xl p-6 shadow-lg"
    >
      <div className="mb-6">
        <h2 className="text-2xl font-heading font-bold text-primary-900 mb-2">
          Send Us a Message
        </h2>
        <p className="text-neutral-600">
          Ready to transform your HR? Let's discuss how we can help your organization succeed.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Name and Email Row */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-primary-900 mb-2">
              Full Name *
            </label>
            <input
              type="text"
              id="name"
              {...register('name', { required: 'Name is required' })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-colors duration-200 ${
                errors.name ? 'border-red-300 bg-red-50' : 'border-neutral-300 hover:border-neutral-400'
              }`}
              placeholder="Your full name"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-primary-900 mb-2">
              Email Address *
            </label>
            <input
              type="email"
              id="email"
              {...register('email', { 
                required: 'Email is required',
                pattern: {
                  value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                  message: 'Invalid email address'
                }
              })}
              className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-colors duration-200 ${
                errors.email ? 'border-red-300 bg-red-50' : 'border-neutral-300 hover:border-neutral-400'
              }`}
              placeholder="your.email@company.com"
            />
            {errors.email && (
              <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
            )}
          </div>
        </div>

        {/* Phone and Company Row */}
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-primary-900 mb-2">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              {...register('phone')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 hover:border-neutral-400 transition-colors duration-200"
              placeholder="+254 700 178 680"
            />
          </div>

          <div>
            <label htmlFor="company" className="block text-sm font-medium text-primary-900 mb-2">
              Company Name
            </label>
            <input
              type="text"
              id="company"
              {...register('company')}
              className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 hover:border-neutral-400 transition-colors duration-200"
              placeholder="Your company name"
            />
          </div>
        </div>

        {/* Subject */}
        <div>
          <label htmlFor="subject" className="block text-sm font-medium text-primary-900 mb-2">
            Subject *
          </label>
          <select
            id="subject"
            {...register('subject', { required: 'Please select a subject' })}
            className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-colors duration-200 ${
              errors.subject ? 'border-red-300 bg-red-50' : 'border-neutral-300 hover:border-neutral-400'
            }`}
          >
            <option value="">Select a service</option>
            <option value="recruitment">Recruitment & Executive Search</option>
            <option value="outsourcing">HR Outsourcing</option>
            <option value="training">Training & Development</option>
            <option value="advisory">HR Advisory & Policy</option>
            <option value="payroll">Payroll Management</option>
            <option value="general">General Inquiry</option>
          </select>
          {errors.subject && (
            <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
          )}
        </div>

        {/* Message */}
        <div>
          <label htmlFor="message" className="block text-sm font-medium text-primary-900 mb-2">
            Message *
          </label>
                  <textarea
                    id="message"
                    rows={6}
                    {...register('message', { required: 'Message is required' })}
                    className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-500 transition-colors duration-200 resize-none ${
                      errors.message ? 'border-red-300 bg-red-50' : 'border-neutral-300 hover:border-neutral-400'
                    }`}
                    placeholder="Tell us about your HR needs and how we can help..."
                  />
          {errors.message && (
            <p className="mt-1 text-sm text-red-600">{errors.message.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <motion.button
          type="submit"
          disabled={isSubmitting}
          whileHover={isDesktop ? { scale: 1.02 } : undefined}
          whileTap={isDesktop ? { scale: 0.98 } : undefined}
          className={`w-full py-4 px-6 rounded-lg font-semibold text-lg transition-all duration-300 flex items-center justify-center ${
            isSubmitting
              ? 'bg-neutral-400 text-neutral-600 cursor-not-allowed'
              : 'bg-primary-900 text-white hover:bg-primary-800 hover:shadow-lg'
          }`}
        >
          {isSubmitting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
              Sending Message...
            </>
          ) : (
            <>
              Send Message
              <Send className="ml-2 w-5 h-5" />
            </>
          )}
        </motion.button>

        {/* Status Messages */}
        {submitStatus === 'success' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-3 p-4 bg-green-50 border border-green-200 rounded-lg"
          >
            <CheckCircle className="w-5 h-5 text-green-600" />
            <p className="text-green-800">Thank you! Your message has been sent successfully.</p>
          </motion.div>
        )}

        {submitStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center space-x-3 p-4 bg-red-50 border border-red-200 rounded-lg"
          >
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-800">Sorry, there was an error sending your message. Please try again.</p>
          </motion.div>
        )}
      </form>
    </motion.div>
  );
};

export default ContactForm;


