/* Copy ported verbatim from pages/experience/experience.html. */

export interface Team {
  name?: string;
  bullets: string[];
  tags: string[];
}

export interface Role {
  id: string;
  org: string;
  role: string;
  badge: string;
  kind: 'Current' | 'Internship';
  location: string;
  period: string;
  start: string;
  teams: Team[];
}

export const experience: Role[] = [
  {
    id: 'amazon-sde',
    org: 'Amazon',
    role: 'Software Development Engineer',
    badge: 'SDE',
    kind: 'Current',
    location: 'San Diego, CA',
    period: 'March 2024 - Present',
    start: '2024',
    teams: [
      {
        name: 'Seller Partner Services: Financial Foundational Services',
        bullets: [
          'Engineered and launched a new scalable, high-throughput region for a financial data aggregation pipeline handling 100M+ daily requests, migrated legacy region with zero-downtime cutover and 100% data integrity, coordinating across 200+ downstream client teams.',
          'Designed end-to-end AWS infrastructure using IaC via AWS CDK, provisioning DynamoDB, S3, SNS, SQS, EC2, and CloudWatch to automate deployments, backfill data, and enable fault-tolerant, event-driven architecture.',
          'Achieved cost optimization of ~$230K/month (~$2.76M annually) by reducing legacy Ireland region footprint, surpassing compliance goals while enabling scalable growth across future regions.',
          'Served as on-call engineer for production incidents including the October 2025 AWS outage, ensuring rapid recovery with minimal customer impact across millions of active workflows.',
          'Authored internal documentation and best practices for multi-region expansions, establishing repeatable system design patterns adopted across the broader engineering org.',
        ],
        tags: [
          'AWS CDK',
          'DynamoDB',
          'S3',
          'SNS/SQS',
          'EC2',
          'CloudWatch',
          'IaC',
          'Event-Driven',
        ],
      },
      {
        name: 'Creators Org: Product Advertising API',
        bullets: [
          'Modernized legacy VIP-based architecture by implementing AWS Network Load Balancers, improving system scalability, traffic management, and monitoring visibility across production environments.',
          'Developed local testing support that removed ~90% of deployment friction, empowering engineers to validate code locally and saving the team multiple days per development cycle.',
        ],
        tags: ['AWS NLB', 'System Design', 'Observability'],
      },
    ],
  },
  {
    id: 'amazon-intern',
    org: 'Amazon',
    role: 'Software Development Engineer Intern',
    badge: 'SDE',
    kind: 'Internship',
    location: 'San Diego, CA',
    period: 'June 2023 - September 2023',
    start: '2023',
    teams: [
      {
        name: 'Seller Partner Services: Financial Foundational Services',
        bullets: [
          'Architected SimBot, an AI-powered automation platform on event-driven architecture (SNS/SQS), cutting team response times by ~95% (days to minutes) via AWS Bedrock integrations with models including OpenAI, Anthropic, and DeepSeek.',
          "Built SimBot's scalable AWS infrastructure using IaC (AWS CDK), DynamoDB, and SQS-driven data pipelines; built SOP-based knowledge bases and applied prompt engineering to optimize LLM behavior from production user feedback.",
          'Designed REST API contracts and data ingestion workflows to integrate SimBot with internal services, enabling cross-functional collaboration with international teams to streamline onboarding, code reviews, and deployments.',
        ],
        tags: [
          'AWS Bedrock',
          'Generative AI',
          'Prompt Engineering',
          'SNS/SQS',
          'DynamoDB',
          'REST APIs',
        ],
      },
    ],
  },
  {
    id: 'bwell',
    org: 'B.well Inc',
    role: 'Software Engineering Intern',
    badge: 'SWE',
    kind: 'Internship',
    location: 'Remote',
    period: 'June 2022 - September 2022',
    start: '2022',
    teams: [
      {
        bullets: [
          'Integrated customer health data using Epic FHIR APIs, enabling reliable synchronization with MyChart applications and improving data accuracy for thousands of users.',
          'Developed full-stack tools to visualize and manage electronic health records (EHRs), improving usability, data accessibility, and patient engagement across web platforms.',
          'Built, containerized, and deployed services using Docker and Kubernetes, supporting scalable development workflows and consistent environments across local and cloud deployments.',
          'Collaborated within an agile team to design, implement, and test RESTful APIs, strengthening frontend-backend integration through peer code reviews and automated testing.',
          'Applied object-oriented design principles and modern JavaScript best practices to deliver maintainable, production-ready code in a regulated healthcare environment.',
        ],
        tags: [
          'Docker',
          'Kubernetes',
          'REST APIs',
          'Epic FHIR',
          'JavaScript',
          'Full-Stack',
        ],
      },
    ],
  },
];
