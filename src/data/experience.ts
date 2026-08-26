/* Copy ported verbatim from pages/experience/experience.html. */

export interface Team {
  name?: string;
  /** One-line condensed version of `bullets`, shown in place of the full
   * list on mobile where five long bullets per team reads as a wall of
   * text. */
  summary: string;
  bullets: string[];
  tags: string[];
}

export interface Role {
  id: string;
  org: string;
  role: string;
  badge: string;
  kind: 'Current' | 'Full-Time' | 'Internship';
  location: string;
  period: string;
  start: string;
  teams: Team[];
}

export const experience: Role[] = [
  {
    id: 'tixtrack-sde2',
    org: 'TixTrack',
    role: 'Software Development Engineer II',
    badge: 'SDE II',
    kind: 'Current',
    location: 'San Diego, CA — Remote',
    period: 'March 2026 - Present',
    start: '2026',
    teams: [
      {
        name: 'Conversion & Checkout',
        summary:
          'Own full-stack development for Conversion & Checkout on a ticketing platform processing 49M+ tickets and $4B+ in transaction value, serving 175+ event merchants across SQL Server, C#/.NET, and Vue.js.',
        bullets: [
          'Owned full-stack development within the Conversion & Checkout team, that has processed 49M+ tickets and $4B+ in gross transaction value, shipping improvements that reduce checkout friction and increase checkout completion and conversion.',
          'Partnered closely with product and stakeholders to translate feature requests into scalable end-to-end solutions across SQL Server, C#/.NET, Entity Framework, REST APIs, and Vue.js, supporting a platform used by 175+ underlying event merchants.',
          'Built reusable Claude Code skills and automated multi-repository engineering workflows for security review, and codebase analysis, increasing development capacity and allowing greater focus on system design, architecture, and engineering work.',
        ],
        tags: ['SQL Server', 'C#/.NET', 'Entity Framework', 'REST APIs', 'Vue.js'],
      },
    ],
  },
  {
    id: 'amazon-sde',
    org: 'Amazon',
    role: 'Software Development Engineer',
    badge: 'SDE',
    kind: 'Full-Time',
    location: 'San Diego, CA',
    period: 'March 2024 - March 2026',
    start: '2024',
    teams: [
      {
        name: 'Seller Partner Services: Financial Foundational Services',
        summary:
          'Led a zero-downtime migration of a 100M+ request/day financial pipeline to a new AWS region, cutting costs by ~$2.76M/yr while holding 100% data integrity and staying on-call for production incidents.',
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
        summary:
          'Modernized legacy load-balancing infrastructure and built local testing tools that removed ~90% of deployment friction for the team.',
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
        summary:
          'Built SimBot, an AI automation platform that cut team response times ~95% (days to minutes) by routing requests to the right LLM via AWS Bedrock.',
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
        summary:
          'Built full-stack tools and APIs to sync and visualize patient health records via Epic FHIR, deployed with Docker and Kubernetes in a regulated healthcare environment.',
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
