// Application constants
export const APP_CONFIG = {
  NAME: 'RitHub',
  DESCRIPTION: 'A platform for conducting human-led researches to evaluatte software engineering artifacts',
  VERSION: '1.0.0',
  AUTHOR: 'S1T10-Shift-Happens',
};

export const MOCK_DATA = {
  STATS: [
    {   
      title: 'Active Studies', 
      value: 3, 
      icon: 'Science', 
      color: '#10a37f', 
      change: '+99%' 
    },
    { 
      title: 'Total Artifacts', 
      value: 47, 
      icon: 'Code', 
      color: '#6366f1', 
      change: '+88%' 
    },
    { 
      title: 'Participants', 
      value: 156, 
      icon: 'People', 
      color: '#f59e0b', 
      change: '+0%' 
    },
    { 
      title: 'Completion Rate', 
      value: '87%', 
      icon: 'TrendingUp', 
      color: '#ef4444', 
      change: '-100%' 
    },
  ],
  
  FEATURES: [
    {
      icon: 'Science',
      title: 'Research Studies',
      description: 'Conduct controlled experiments with multiple artifact types and participant groups.',
      color: '#10a37f'
    },
    {
      icon: 'Code',
      title: 'Code Analysis',
      description: 'Compare source code, test cases, and documentation with advanced diff capabilities.',
      color: '#6366f1'
    },
    {
      icon: 'Assessment',
      title: 'Quality Metrics',
      description: 'Evaluate artifacts using customizable rating scales and annotation tools.',
      color: '#f59e0b'
    },
    {
      icon: 'People',
      title: 'Participant Management',
      description: 'Recruit, manage, and track participants throughout your research studies.',
      color: '#ef4444'
    },
    {
      icon: 'TrendingUp',
      title: 'Analytics Dashboard',
      description: 'Visualize results with comprehensive charts and statistical analysis tools.',
      color: '#8b5cf6'
    },
    {
      icon: 'Security',
      title: 'Data Privacy',
      description: 'Secure data handling with GDPR compliance and participant consent management.',
      color: '#06b6d4'
    }
  ],
  
  BENEFITS: [
    'Streamlined study design and execution',
    'Automated data collection and analysis',
    'Real-time progress monitoring',
    'Export results in multiple formats',
    'Collaborative research environment',
    'Built-in statistical analysis tools'
  ],
  
  USE_CASES: [
    {
      title: 'Academic Research',
      description: 'Perfect for universities conducting software engineering research',
      icon: 'School',
      examples: ['Code quality studies', 'Testing methodology research', 'Developer productivity analysis']
    },
    {
      title: 'Industry Studies',
      description: 'Ideal for companies evaluating internal tools and processes',
      icon: 'Business',
      examples: ['Tool comparison studies', 'Process improvement research', 'Team performance analysis']
    }
  ],
  
  STATS_HERO: [
    { value: '500+', label: 'Studies Conducted' },
    { value: '2.5K+', label: 'Participants' },
    { value: '50+', label: 'Universities' },
    { value: '95%', label: 'Satisfaction Rate' },
  ]
};
