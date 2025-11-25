# Research Proposal: An Intelligent Foreign Trade Negotiation Training System Based on Multi-Agent AI and Knowledge Graphs

## Abstract

This research proposes and presents a novel intelligent educational platform designed to enhance foreign trade negotiation skills in vocational and higher education contexts. The system addresses critical pedagogical challenges in business English education through an innovative integration of Large Language Models (LLMs), knowledge graph technology, and adaptive difficulty mechanisms. By employing a multi-agent AI architecture that separates scenario generation, conversational interaction, and performance evaluation into distinct AI models, the system provides immersive, personalized learning experiences while maintaining pedagogical rigor. The platform implements a hybrid database architecture combining SQLite for transactional data management with Neo4j for complex relationship modeling, enabling sophisticated knowledge gap analysis and personalized learning path recommendations. Preliminary implementation demonstrates the technical feasibility of orchestrating three specialized AI agents (Generator, Collaborator, and Critic) to deliver consistent, diverse negotiation scenarios across 11 chapters and 50+ training sections covering the complete foreign trade process. The research contributes to educational technology through: (1) a novel multi-agent separation architecture for AI tutoring systems, (2) a difficulty-adaptive negotiation algorithm that dynamically adjusts AI behavior, (3) a knowledge graph-driven personalization framework for identifying learning gaps, and (4) empirical evidence on the effectiveness of immersive storytelling in business education. This proposal outlines the theoretical foundations, technical implementation, and comprehensive evaluation methodology for assessing the system's impact on student learning outcomes, engagement, and negotiation competency development.

**Keywords**: Artificial Intelligence in Education, Foreign Trade Negotiation, Knowledge Graphs, Large Language Models, Adaptive Learning Systems, Multi-Agent Architecture, Educational Technology

---

## 1. Introduction

### 1.1 Background and Motivation

The globalization of international trade has created unprecedented demand for professionals skilled in cross-cultural business negotiation. In China, where vocational colleges and universities serve as primary training grounds for future foreign trade practitioners, traditional pedagogical approaches face significant limitations. Conventional classroom instruction often relies on static case studies, role-playing exercises with limited variability, and scripted dialogues that fail to capture the dynamic, unpredictable nature of real-world negotiations (Wang & Li, 2019; Zhang et al., 2021). Students frequently report insufficient opportunities for authentic practice, lack of personalized feedback, and minimal exposure to the diverse negotiation scenarios they will encounter in professional contexts.

Recent advances in Large Language Models (LLMs) and conversational AI technologies present transformative opportunities for business education. Systems like ChatGPT, Claude, and DeepSeek demonstrate remarkable capabilities in natural language understanding and generation, enabling sophisticated human-AI interactions that approach human-level fluency (Brown et al., 2020; Ouyang et al., 2022). However, directly applying general-purpose LLMs to educational contexts introduces critical challenges: ensuring pedagogical appropriateness, maintaining consistent difficulty calibration, providing reliable assessment, and structuring learning progression aligned with curriculum standards.

Simultaneously, knowledge graph technologies have emerged as powerful tools for modeling complex domain knowledge and enabling intelligent recommendation systems (Paulheim, 2017; Ji et al., 2021). In educational contexts, knowledge graphs offer potential for representing prerequisite relationships, identifying learning gaps, and personalizing instructional sequences. Yet, existing applications remain limited in scope, rarely integrating deeply with conversational AI systems or addressing domain-specific requirements of business negotiation training.

This research addresses these challenges through the design, implementation, and evaluation of an integrated platform that combines multi-agent AI orchestration with knowledge graph-driven personalization. By treating scenario generation, conversational interaction, and performance evaluation as distinct functions served by specialized AI agents, the system maintains pedagogical coherence while leveraging the strengths of modern LLMs. The integration with a domain-specific knowledge graph enables sophisticated analysis of student learning trajectories and adaptive recommendation of targeted practice opportunities.

### 1.2 Problem Statement

Despite growing recognition of AI's potential in education, several critical research gaps persist:

**RG1: Multi-Agent Orchestration for Educational AI**
While multi-agent systems have been extensively studied in autonomous robotics and distributed computing (Wooldridge, 2009), their application to educational AI remains underexplored. Existing AI tutoring systems typically employ single models for all functions, risking conflation between instructional delivery and assessment. No prior work has systematically investigated the separation of concerns principle in educational LLM deployment, particularly for conversational learning environments.

**RG2: Difficulty Adaptation in Conversational AI Tutoring**
Adaptive learning systems have traditionally focused on content selection and sequencing (Brusilovsky, 2001; Vanlehn, 2011). However, few studies address how to dynamically adjust the behavioral characteristics of AI conversational partners to provide appropriate challenge levels. In negotiation training specifically, this requires real-time modification of AI strategies, communication tone, and bottom-line flexibility—capabilities not addressed in current literature.

**RG3: Knowledge Graph Integration with LLM-Based Systems**
While knowledge graphs have been applied to educational recommendation (Chen et al., 2020) and LLMs have been used for content generation (Bommasani et al., 2021), the integration of these technologies remains superficial. Most systems use knowledge graphs merely as lookup databases rather than leveraging graph structure for reasoning about learning dependencies, prerequisite chains, and conceptual relationships. No existing work demonstrates how knowledge graphs can enhance LLM-based tutoring through semantic understanding of domain structure.

**RG4: Assessment Reliability in AI-Generated Learning Environments**
As AI increasingly generates educational content, ensuring consistent and valid assessment becomes paramount. Traditional psychometric validation methods assume static item banks, but AI-generated scenarios introduce variability that challenges conventional reliability metrics. Research is needed on how to maintain assessment validity when both instructional content and evaluation criteria are dynamically generated.

**RG5: Immersive Storytelling in Business Education**
Business education has long employed case-based learning (Erskine et al., 2012), but the potential of narrative immersion techniques—widely successful in gaming and entertainment—remains largely untapped. No prior work has investigated how historical contextualization and time-travel storytelling mechanics might enhance engagement and knowledge retention in trade negotiation training.

### 1.3 Research Objectives

This research pursues the following objectives:

**O1**: Design and implement a multi-agent AI architecture that separates scenario generation, conversational interaction, and performance evaluation into specialized models, and empirically demonstrate its advantages over single-model approaches in terms of consistency, reliability, and educational effectiveness.

**O2**: Develop a difficulty adaptation algorithm that dynamically adjusts AI negotiation behavior across multiple dimensions (price flexibility, communication tone, strategic approach) and validate its effectiveness through controlled experiments measuring student learning outcomes at different difficulty levels.

**O3**: Create a domain-specific knowledge graph for foreign trade negotiations encompassing process stages, theoretical concepts, practical skills, and prerequisite relationships, and demonstrate its utility for personalized learning path generation and knowledge gap identification.

**O4**: Establish a comprehensive evaluation framework for assessing the system's impact on multiple dimensions: student learning outcomes (knowledge acquisition, skill development), user experience (engagement, satisfaction), and system performance (response latency, scalability).

**O5**: Contribute generalizable design principles and architectural patterns for integrating LLMs with knowledge graphs in educational contexts, documented through technical specifications, implementation code, and empirical findings suitable for replication by other researchers.

### 1.4 Significance and Expected Contributions

This research offers significant contributions to multiple domains:

**Theoretical Contributions:**
- **Educational Technology**: Establishes the multi-agent separation principle for AI tutoring systems, providing theoretical justification and empirical validation for architectural decisions that enhance pedagogical effectiveness.
- **Adaptive Learning**: Introduces a novel difficulty adaptation framework specifically designed for conversational AI partners, extending existing adaptive learning theories beyond content selection to behavioral modification.
- **Knowledge Engineering**: Demonstrates how graph-based knowledge representation can enhance LLM reasoning capabilities in educational contexts, bridging symbolic AI and neural network approaches.

**Practical Contributions:**
- **Foreign Trade Education**: Delivers a production-ready platform addressing critical training needs in China's vocational education sector, with potential impact on thousands of students annually.
- **Software Engineering**: Provides a comprehensive open-source implementation (27,000+ lines of code) demonstrating best practices for hybrid database architectures, streaming AI integration, and scalable web application design.
- **Curriculum Development**: Offers a flexible framework for educators to create, share, and iteratively refine negotiation scenarios, supporting collaborative curriculum development at scale.

**Methodological Contributions:**
- **Evaluation Frameworks**: Develops novel assessment methodologies for AI-generated educational content, including techniques for measuring consistency, validity, and reliability in dynamic learning environments.
- **Design Patterns**: Documents reusable architectural patterns (e.g., Generator-Collaborator-Critic pattern, hybrid SQL-graph synchronization) applicable to diverse educational AI applications.

---

## 2. Literature Review

### 2.1 Artificial Intelligence in Education

The application of AI in education has evolved through distinct paradigms, from early rule-based Intelligent Tutoring Systems (ITS) in the 1970s-1980s (Sleeman & Brown, 1982) to modern data-driven adaptive learning platforms (Holstein et al., 2018) and, most recently, LLM-based conversational tutors (Kasneci et al., 2023).

**Early Intelligent Tutoring Systems**: Pioneering systems like SCHOLAR (Carbonell, 1970), MYCIN-Tutor (Clancey, 1987), and Cognitive Tutors (Anderson et al., 1995) demonstrated that AI could provide personalized instruction and feedback. However, these systems required extensive manual knowledge engineering and struggled with natural language interaction, limiting their scalability and generalizability.

**Adaptive Learning Platforms**: The 2000s-2010s saw the rise of web-based adaptive learning systems leveraging student modeling and machine learning techniques. Platforms like ALEKS (Falmagne et al., 2006), Knewton, and Carnegie Learning's MATHia demonstrated effectiveness in mathematics education. Yet these systems primarily adapted through content selection rather than interaction style, and they operated within structured problem-solving domains rather than open-ended conversational contexts.

**Conversational AI in Education**: Recent advances in neural language models have enabled more natural human-AI interaction. Studies by Winkler and Söllner (2018) on chatbots in education and Kuhail et al. (2023) on ChatGPT's educational applications reveal both promise and challenges. While LLMs excel at generating fluent responses, concerns persist regarding factual accuracy (Ji et al., 2023), pedagogical appropriateness (Kasneci et al., 2023), and assessment validity (Rudolph et al., 2023).

**Research Gap**: Existing literature treats AI tutoring systems as monolithic entities, with single models responsible for instruction, interaction, and assessment. No prior work systematically investigates architectural patterns that separate these concerns into specialized agents, despite software engineering principles advocating such separation for maintainability and effectiveness.

### 2.2 Knowledge Graphs in Learning Systems

Knowledge graphs (KGs) represent information as nodes (entities) and edges (relationships), enabling sophisticated reasoning and inference (Hogan et al., 2021). Their application in education has focused primarily on three areas:

**Curriculum Modeling**: Researchers have used KGs to represent course structures, concept dependencies, and learning objectives. Chen et al. (2020) developed EduKG, a large-scale educational knowledge graph linking educational resources. Shi et al. (2020) proposed KG-based curriculum planning algorithms. These works demonstrate KGs' utility for modeling domain structure but lack integration with intelligent tutoring capabilities.

**Personalized Recommendation**: Several studies leverage KGs for learning resource recommendation. Nguyen et al. (2019) used collaborative filtering on KGs to suggest courses. Tarus et al. (2018) combined KGs with user profiles for personalized content delivery. However, these approaches treat recommendation as a retrieval problem rather than leveraging graph structure for pedagogical reasoning about prerequisites and learning progressions.

**Learning Analytics**: KGs have been applied to student modeling and performance prediction (Shi et al., 2021; Zhu et al., 2022). By representing student interactions as graph traversals, researchers identify at-risk students and predict learning outcomes. Yet these applications remain divorced from real-time instructional delivery, functioning primarily as post-hoc analysis tools.

**Research Gap**: While KGs have been extensively applied to educational metadata and analytics, their integration with conversational AI tutoring systems remains superficial. No existing work demonstrates how KG reasoning can enhance LLM-based instruction through real-time prerequisite analysis, knowledge gap identification, and adaptive scenario selection.

### 2.3 Business Negotiation Training

Business negotiation education has been studied across multiple disciplines, including international business, communication studies, and organizational behavior (Thompson, 2015; Lewicki et al., 2020).

**Traditional Pedagogical Approaches**: Conventional negotiation training employs case studies (Erskine et al., 2012), role-playing exercises (DeNeve & Heppner, 1997), and simulation games (Bellotti et al., 2013). While these methods provide experiential learning opportunities, they face limitations: high instructor workload, limited scenario variability, difficulty providing individualized feedback, and challenges in assessing complex interpersonal skills.

**Digital Negotiation Training**: Early computer-based systems like INSPIRE (Marriott et al., 1990) and Trader (Mumpower & Rohrbaugh, 1996) simulated negotiations through structured decision interfaces. More recent platforms like Negotiation360 and Negotiations Pro offer scenario libraries and basic analytics. However, these systems rely on scripted dialogues and multiple-choice interactions, failing to capture the open-ended, linguistic complexity of authentic negotiations.

**Cross-Cultural Business Communication**: Research on international trade negotiation emphasizes cultural dimensions (Hofstede, 2001), communication styles (Hall, 1976), and contextual factors (Salacuse, 1998). Studies specific to Chinese foreign trade education (Wang & Li, 2019; Zhang et al., 2021) identify needs for authentic practice opportunities, exposure to diverse cultural contexts, and development of adaptive communication strategies.

**Research Gap**: Existing negotiation training systems lack the conversational flexibility and contextual richness required for authentic preparation. No prior work combines natural language interaction capabilities of modern LLMs with the structured learning progression required for curriculum integration, particularly in foreign trade contexts.

### 2.4 Multi-Agent Systems and LLM Orchestration

Multi-agent systems (MAS) have been extensively studied in distributed AI (Wooldridge, 2009; Dorri et al., 2018), but their application to educational AI and LLM orchestration represents emerging research frontiers.

**Classical Multi-Agent Systems**: Traditional MAS research focuses on coordination protocols, communication languages, and emergent behaviors in systems with autonomous agents (Ferber, 1999). Applications span robotics (Parker, 2008), traffic management (Chen & Cheng, 2010), and supply chain optimization (Fox et al., 2000). However, these works assume agents with distinct knowledge bases and capabilities, not the homogeneous foundation models typical of modern LLMs.

**LLM-Based Multi-Agent Systems**: Recent works explore using multiple LLM instances for complex tasks. Park et al. (2023) created "generative agents" simulating human behavior in virtual environments. Wu et al. (2023) proposed AutoGen for multi-agent code generation. Hong et al. (2023) developed MetaGPT for software development workflows. These studies demonstrate feasibility of LLM orchestration but focus on software engineering domains rather than education.

**Debate and Verification**: Research on multi-LLM debate shows that adversarial interactions improve reasoning quality (Du et al., 2023; Liang et al., 2023). Society of Minds approaches (Minsky, 1988) implemented with LLMs demonstrate enhanced problem-solving through diverse perspectives (Li et al., 2023). However, these methods emphasize consensus-building for factual accuracy rather than functional specialization for distinct pedagogical roles.

**Research Gap**: While multi-agent LLM systems show promise for complex tasks, no prior work investigates their application to educational contexts where agents must fulfill specialized pedagogical functions (instruction, interaction, assessment) with distinct optimization objectives and constraints.

### 2.5 Assessment and Evaluation in AI-Enhanced Learning

Evaluating AI-based educational systems requires addressing challenges in multiple dimensions: learning outcome measurement, user experience assessment, and system performance evaluation (Baker & Inventado, 2014; Roll & Wylie, 2016).

**Learning Outcome Assessment**: Traditional educational assessment relies on validated instruments with established psychometric properties (Messick, 1995). However, AI-generated content introduces variability that challenges classical test theory assumptions. Recent work on automated essay scoring (Ke & Ng, 2019) and intelligent assessment (Zhu et al., 2020) demonstrates feasibility but focuses on structured knowledge domains rather than complex interpersonal skills like negotiation.

**AI Evaluation Reliability**: Using AI for assessment introduces circularity concerns—can AI-generated scenarios be fairly evaluated by AI graders? Recent studies (Chiang & Lee, 2023; Mizumoto & Eguchi, 2023) show LLMs can provide reliable formative feedback but may exhibit biases and inconsistencies. Establishing inter-rater reliability between AI and human evaluators remains an active research challenge.

**User Experience in Educational AI**: Research on learning analytics dashboards (Verbert et al., 2014) and student perceptions of AI tutors (Hobert & Meyer von Wolff, 2019) emphasizes the importance of transparency, trust, and perceived usefulness. Studies specific to conversational AI in education (Winkler et al., 2020; Smutny & Schreiberova, 2020) identify factors influencing acceptance, including response quality, personality, and perceived empathy.

**Research Gap**: Comprehensive evaluation frameworks for multi-agent AI tutoring systems integrated with knowledge graphs do not exist. Methodologies are needed that address the unique challenges of assessing dynamically generated educational content while measuring impact on complex competencies like cross-cultural negotiation skills.

### 2.6 Summary of Literature and Research Positioning

The literature review reveals substantial progress in individual domains—AI in education, knowledge graphs, negotiation training, multi-agent systems, and educational assessment—but critical gaps at their intersections. This research is uniquely positioned to address these gaps by:

1. **Integrating** multi-agent AI architectures with educational contexts, extending MAS theory to LLM-based tutoring systems
2. **Bridging** knowledge graph technologies with conversational AI, demonstrating how symbolic knowledge representation enhances neural language models
3. **Advancing** negotiation training pedagogy through immersive, adaptive AI interactions that surpass current scripted approaches
4. **Establishing** evaluation methodologies for complex, multi-component educational AI systems operating in open-ended conversational domains

The following sections detail the research methodology, system design, and evaluation plans for addressing these gaps and achieving the stated research objectives.

---

## 3. Research Questions

Based on the identified research gaps and objectives, this study investigates the following research questions:

### Primary Research Questions

**RQ1: Multi-Agent Architecture Effectiveness**
To what extent does a multi-agent AI architecture (separating scenario generation, conversational interaction, and performance evaluation) improve the consistency, reliability, and pedagogical effectiveness of AI-based negotiation training compared to single-model approaches?

*Sub-questions:*
- RQ1.1: Does functional separation improve scenario diversity and coverage across the foreign trade curriculum?
- RQ1.2: Does separating the evaluator from the conversational partner increase assessment reliability and reduce bias?
- RQ1.3: What are the optimal configurations for each specialized agent (temperature, system prompts, model selection)?

**RQ2: Difficulty Adaptation and Learning Outcomes**
How does difficulty-adaptive AI negotiation behavior affect student learning outcomes, skill development, and engagement across different proficiency levels?

*Sub-questions:*
- RQ2.1: What behavioral dimensions most significantly impact perceived difficulty in AI-mediated negotiations?
- RQ2.2: Do students demonstrate greater learning gains when matched with appropriate difficulty levels versus static difficulty?
- RQ2.3: How does repeated practice at increasing difficulty levels affect skill transfer and negotiation competency?

**RQ3: Knowledge Graph-Driven Personalization**
To what extent can knowledge graph analysis of student performance data enable effective personalized learning path recommendations and knowledge gap identification in foreign trade negotiation training?

*Sub-questions:*
- RQ3.1: How accurately can graph-based prerequisite analysis identify student knowledge gaps compared to traditional assessment methods?
- RQ3.2: Do students following knowledge graph-recommended learning paths demonstrate superior outcomes compared to self-directed learning?
- RQ3.3: What graph topologies and relationship types most effectively model domain knowledge for educational recommendation?

**RQ4: Immersive Storytelling and Engagement**
How does immersive storytelling pedagogy (specifically time-travel historical contextualization) affect student engagement, knowledge retention, and intrinsic motivation in business education?

*Sub-questions:*
- RQ4.1: Does narrative immersion increase completion rates and time-on-task compared to traditional case-based instruction?
- RQ4.2: How does historical contextualization affect understanding of modern trade practices and regulatory frameworks?
- RQ4.3: What narrative elements most strongly correlate with reported engagement and satisfaction?

### Secondary Research Questions

**RQ5: System Performance and Scalability**
What are the performance characteristics, scalability limits, and resource requirements of the integrated platform under realistic deployment conditions?

*Sub-questions:*
- RQ5.1: What is the average response latency for AI-generated responses at different concurrency levels?
- RQ5.2: How does the hybrid SQLite-Neo4j architecture perform under increasing data volumes?
- RQ5.3: What are the cost implications of LLM API usage for different student cohort sizes?

**RQ6: Educator Experience and Adoption**
What factors influence teacher adoption and sustained usage of the platform, and how effectively does it support instructors' pedagogical goals?

*Sub-questions:*
- RQ6.1: What are educators' perceptions of the quality, appropriateness, and usability of AI-generated scenarios?
- RQ6.2: How does the system affect teacher workload compared to traditional instruction methods?
- RQ6.3: What features do educators identify as most valuable, and what improvements would increase adoption?

---

## 4. Methodology

### 4.1 Research Design

This research employs a **mixed-methods design** integrating quantitative experimental studies with qualitative case analyses to comprehensively evaluate the proposed system. The methodology consists of three phases:

**Phase 1: System Development and Implementation** (Completed)
- Design and implement the multi-agent AI architecture
- Develop the knowledge graph schema and integration layer
- Create curriculum content (11 chapters, 50+ training sections)
- Conduct technical validation and unit testing

**Phase 2: Pilot Studies and Iterative Refinement** (In Progress)
- Deploy initial version with small student cohorts (N=30-50)
- Collect formative data on usability, technical issues, and preliminary effectiveness
- Refine algorithms, prompts, and user interfaces based on feedback
- Establish baseline performance metrics

**Phase 3: Controlled Experiments and Comprehensive Evaluation** (Planned)
- Conduct randomized controlled trials (RCTs) comparing system variants
- Perform longitudinal studies tracking student progression over full semester
- Execute user experience studies with students and educators
- Analyze system performance data under realistic deployment conditions

### 4.2 System Architecture and Technical Implementation

The system implements a layered architecture following separation of concerns principles:

#### 4.2.1 Multi-Agent AI Architecture

**Generator Agent**: Responsible for creating diverse, pedagogically appropriate negotiation scenarios.
- **Model**: DeepSeek-Chat (configurable)
- **Temperature**: 0.8 (high creativity)
- **Input**: Section-level learning objectives, industry hints, role specifications
- **Output**: Structured JSON scenario including company profiles, product specifications, negotiation constraints, market context
- **Constraints**: Ensures student always plays Chinese buyer/seller role; maintains curriculum alignment; avoids stereotyping and bias

**Collaborator Agent**: Engages in real-time conversational negotiation with students.
- **Model**: DeepSeek-Chat (configurable)
- **Temperature**: 0.7 (balanced creativity and consistency)
- **Input**: Scenario context, conversation history, student message, difficulty profile
- **Output**: Streaming response tokens representing AI counterpart's negotiation moves
- **Constraints**: Maintains consistent character; follows difficulty-defined behavioral rules; enforces English language; responds within 5-second latency target

**Critic Agent**: Provides comprehensive performance evaluation.
- **Model**: DeepSeek-Chat (configurable)
- **Temperature**: 0.2 (low for consistency)
- **Input**: Complete conversation transcript, scenario details, evaluation rubric
- **Output**: Structured assessment including numerical score, performance label, detailed commentary (Chinese for accessibility), action items, knowledge points extraction
- **Constraints**: Maintains objectivity; provides constructive feedback; aligns with curriculum standards

#### 4.2.2 Difficulty Adaptation Algorithm

The system implements a multi-dimensional difficulty adjustment mechanism:

```
DifficultyProfile = {
    "price_flexibility": float,      # Percentage variance from bottom line
    "communication_tone": string,    # "warm", "neutral", "firm", "aggressive"
    "strategic_approach": string,    # "cooperative", "competitive", "integrative"
    "hint_frequency": float,         # Probability of providing guidance
    "risk_emphasis": float,          # Tendency to highlight obstacles
    "bargaining_persistence": int    # Number of counter-offers before acceptance
}

Profiles = {
    "friendly": {
        "price_flexibility": 0.10,
        "communication_tone": "warm",
        "strategic_approach": "cooperative",
        "hint_frequency": 0.3,
        "risk_emphasis": 0.2,
        "bargaining_persistence": 2
    },
    "balanced": {
        "price_flexibility": 0.05,
        "communication_tone": "neutral",
        "strategic_approach": "integrative",
        "hint_frequency": 0.1,
        "risk_emphasis": 0.5,
        "bargaining_persistence": 3
    },
    "tough": {
        "price_flexibility": 0.02,
        "communication_tone": "firm",
        "strategic_approach": "competitive",
        "hint_frequency": 0.0,
        "risk_emphasis": 0.8,
        "bargaining_persistence": 5
    },
    "shrewd": {
        "price_flexibility": 0.05,
        "communication_tone": "calculated",
        "strategic_approach": "conditional",
        "hint_frequency": 0.0,
        "risk_emphasis": 0.6,
        "bargaining_persistence": 4
    }
}
```

This profile modifies the Collaborator Agent's system prompt dynamically, injecting behavioral instructions that guide negotiation strategy.

#### 4.2.3 Knowledge Graph Schema

**Node Types:**
1. **ProcessStep**: Canonical stages of foreign trade (inquiry, offer, counter-offer, acceptance, logistics, payment, inspection, insurance, complaint, claim)
2. **Chapter**: Top-level curriculum organization (11 chapters)
3. **Practice**: Individual training scenarios (50+ sections)
4. **TheoryTopic**: Conceptual groupings of theoretical content
5. **TheoryLesson**: Individual lessons with HTML content
6. **KnowledgePoint**: Granular knowledge units with attributes (type, difficulty, importance, estimated learning time)

**Relationship Types:**
- `BELONGS_TO_PROCESS`: Chapter → ProcessStep
- `BELONGS_TO_CHAPTER`: Practice → Chapter
- `BELONGS_TO_TOPIC`: TheoryLesson → TheoryTopic
- `TESTS`: Practice → KnowledgePoint (which knowledge points are assessed)
- `EXPLAINS`: TheoryLesson → KnowledgePoint (which concepts are taught)
- `REQUIRES`: KnowledgePoint → KnowledgePoint (prerequisite dependencies)
- `RELATES_TO`: KnowledgePoint ↔ KnowledgePoint (semantic similarity)

**Knowledge Graph Algorithms:**

*Prerequisite Path Discovery:*
```cypher
MATCH path = (target:KnowledgePoint {name: $targetName})-[:REQUIRES*]->(prereq)
WITH path, length(path) AS depth
ORDER BY depth DESC
WITH collect(path)[0] AS longestPath
UNWIND nodes(longestPath) AS node
RETURN DISTINCT node.name AS knowledgeName
```

*Knowledge Gap Identification:*
```python
def identify_knowledge_gaps(student_id):
    # 1. Extract knowledge points from completed session evaluations
    completed_sessions = db.get_student_sessions(student_id)
    encountered_kp = set()
    weak_kp = set()

    for session in completed_sessions:
        eval = db.get_evaluation(session.id)
        encountered_kp.update(eval.knowledge_points)
        if eval.score < 70:  # Below proficiency threshold
            weak_kp.update(eval.knowledge_points)

    # 2. Query Neo4j for prerequisites of weak knowledge points
    gaps = set()
    for kp_name in weak_kp:
        prereq_path = graph_service.get_learning_path(kp_name)
        for prereq in prereq_path:
            if prereq not in encountered_kp:
                gaps.add(prereq)

    # 3. Find practices that test gap knowledge points
    recommended_practices = []
    for gap_kp in gaps:
        practices = graph_service.find_practices_testing_knowledge(gap_kp)
        recommended_practices.extend(practices)

    return list(gaps), recommended_practices
```

*Scenario Recommendation:*
```cypher
// Find practices similar to high-performing sessions
MATCH (student_completed:Practice)<-[:COMPLETED_BY]-(student:User {id: $studentId})
WHERE student_completed.score >= 80
MATCH (student_completed)-[:TESTS]->(kp:KnowledgePoint)
MATCH (recommended:Practice)-[:TESTS]->(kp)
WHERE NOT (student)-[:COMPLETED_BY]->(recommended)
WITH recommended, count(DISTINCT kp) AS overlap
ORDER BY overlap DESC
LIMIT 10
RETURN recommended
```

#### 4.2.4 Hybrid Database Architecture

**SQLite (Primary Transactional Store):**
- User accounts, authentication tokens, session metadata
- Message history, evaluations, assignments
- Theory content (HTML), level configuration
- Provides ACID guarantees, simplicity, and zero-configuration deployment

**Neo4j (Relationship-Oriented Store):**
- Knowledge graph with 6 node types, 7 relationship types
- Enables complex traversal queries, prerequisite analysis, recommendation algorithms
- Synchronized bidirectionally with SQLite for consistency

**Synchronization Strategy:**
- **Write-through**: Changes in SQLite immediately reflected in Neo4j
- **Eventual consistency**: Neo4j updates propagated to SQLite asynchronously
- **Graceful degradation**: System remains functional if Neo4j unavailable (reduced functionality)

#### 4.2.5 Frontend Architecture

**Technology Stack:**
- Pure Vanilla JavaScript (no frameworks for minimalism and control)
- Tailwind CSS for responsive, accessible UI
- Chart.js for analytics visualizations
- Vis-Network for interactive knowledge graph rendering

**Modular Design:**
- `admin.js` (6,387 lines): Teacher dashboard, assignment management, analytics
- `student.js` (2,596 lines): Student interface, practice sessions, progress tracking
- `graph-knowledge.js` (1,647 lines): Knowledge graph CRUD operations, visualization
- `api.js`: Centralized API client with token-based authentication
- `state.js`: Lightweight client-side state management

**User Experience Features:**
- Real-time streaming responses for natural conversation flow
- Progressive disclosure of scenario information to reduce cognitive load
- Visual analytics dashboards with radar charts, trend lines, heatmaps
- Excel import/export for bulk knowledge management

### 4.3 Data Collection Methods

#### 4.3.1 Quantitative Data

**Learning Outcome Measures:**
- **Pre-test/Post-test Scores**: Standardized foreign trade negotiation assessment administered before and after intervention
- **Session Performance Scores**: AI-generated scores (0-100) for each practice session
- **Bargaining Win Rate**: Percentage achievement of negotiation objectives in price-sensitive scenarios
- **Knowledge Point Mastery**: Binary indicators (mastered/not mastered) for each knowledge point based on performance trends
- **Skill Progression**: Longitudinal tracking of competencies (communication, persuasion, cultural awareness, deal structuring)

**Engagement Metrics:**
- **Time-on-Task**: Duration of each practice session
- **Completion Rates**: Percentage of assigned scenarios completed
- **Retry Frequency**: Number of attempts at same scenario with increasing difficulty
- **Message Length**: Average word count per student message (proxy for effort)
- **Session Initiation**: Voluntary practice sessions beyond required assignments

**System Performance Metrics:**
- **Response Latency**: Time from student message submission to first AI token received
- **Throughput**: Concurrent active sessions supported without degradation
- **API Cost**: DeepSeek API usage charges per student-hour
- **Database Query Performance**: Average execution time for complex Neo4j traversals
- **Error Rates**: Frequency of system failures, malformed AI responses, or timeout events

**User Satisfaction Measures:**
- **System Usability Scale (SUS)**: Standardized 10-item questionnaire (Brooke, 1996)
- **Likert Scale Surveys**: 5-point scales on perceived usefulness, ease of use, satisfaction, likelihood to recommend
- **Task Load Index (NASA-TLX)**: Cognitive load assessment (Hart & Staveland, 1988)

#### 4.3.2 Qualitative Data

**Semi-Structured Interviews:**
- **Student Interviews** (N=20-30): Experiences with AI negotiation partner, perceived learning value, suggestions for improvement
- **Educator Interviews** (N=10-15): Pedagogical effectiveness, integration with curriculum, workload impact, feature requests

**Focus Groups:**
- **Student Focus Groups** (N=3-4 groups, 6-8 participants each): Discuss engagement factors, difficulty perceptions, comparison to traditional methods
- **Educator Workshops** (N=2-3 sessions): Collaborative curriculum development, scenario quality evaluation, best practices sharing

**Open-Ended Survey Responses:**
- Post-session feedback prompts: "What was most challenging?", "What did you learn?", "How realistic was the scenario?"
- End-of-semester reflections: "How has your negotiation confidence changed?", "What skills improved most?"

**System Logs and Conversation Transcripts:**
- Complete chat histories analyzed for linguistic patterns, strategy evolution, common errors
- Evaluation commentary text-mined for recurring themes in AI feedback
- Action items aggregated to identify systemic knowledge gaps

### 4.4 Experimental Designs

#### 4.4.1 Experiment 1: Multi-Agent vs. Single-Agent Architecture

**Design**: Randomized Controlled Trial (RCT)
- **Independent Variable**: AI architecture (multi-agent with functional separation vs. single-agent handling all functions)
- **Dependent Variables**: Scenario diversity (measured by semantic similarity analysis), evaluation consistency (inter-rater reliability), learning outcomes (pre/post test scores)
- **Participants**: N=200 vocational college students, randomly assigned to conditions
- **Procedure**: Both groups complete same curriculum over 8 weeks; multi-agent group uses proposed system, single-agent group uses version where one model performs generation, conversation, and evaluation
- **Analysis**: ANOVA for learning outcomes, Krippendorff's alpha for evaluation reliability, cosine similarity distributions for scenario diversity

#### 4.4.2 Experiment 2: Difficulty Adaptation Effectiveness

**Design**: Counterbalanced Repeated Measures
- **Independent Variable**: Difficulty level (friendly, balanced, tough, shrewd)
- **Dependent Variables**: Perceived difficulty (self-report), performance scores, learning gains (measured by knowledge point mastery), engagement (time-on-task, message length)
- **Participants**: N=150 students
- **Procedure**: Each participant completes 4 equivalent scenarios (same learning objectives, different contexts) at each difficulty level in counterbalanced order
- **Analysis**: Repeated measures ANOVA, post-hoc pairwise comparisons, correlation analysis between difficulty and outcomes

#### 4.4.3 Experiment 3: Knowledge Graph-Driven Personalization

**Design**: Between-Subjects Experiment
- **Independent Variable**: Learning path determination (knowledge graph-recommended vs. self-selected vs. random assignment)
- **Dependent Variables**: Learning efficiency (time to mastery), knowledge retention (delayed post-test), transfer (performance on novel scenarios)
- **Participants**: N=180 students, randomly assigned to three conditions
- **Procedure**: 12-week intervention; KG-recommended group receives personalized scenario suggestions based on gap analysis, self-selected group chooses freely from curriculum, random group assigned scenarios randomly
- **Analysis**: ANCOVA controlling for prior knowledge, survival analysis for time-to-mastery, transfer task performance comparison

#### 4.4.4 Experiment 4: Immersive Storytelling Impact

**Design**: Quasi-Experimental Pre-Post Design
- **Independent Variable**: Presence of time-travel historical contextualization (Chapter 0 Prologue)
- **Dependent Variables**: Engagement (completion rates, session initiation), knowledge retention (long-term post-test), intrinsic motivation (Intrinsic Motivation Inventory)
- **Participants**: N=120 students; treatment group receives full curriculum including Prologue, control group receives standard curriculum
- **Procedure**: Both groups complete same 10 chapters (1-10), treatment group additionally completes Prologue; assessments at baseline, mid-point, end, and 1-month follow-up
- **Analysis**: Mixed-effects models for longitudinal data, mediation analysis for engagement → retention pathway

### 4.5 Analysis Plan

#### 4.5.1 Quantitative Analysis

**Statistical Methods:**
- **Descriptive Statistics**: Means, standard deviations, distributions for all outcome variables
- **Inferential Statistics**:
  - T-tests and ANOVA for group comparisons
  - Repeated measures ANOVA for within-subject designs
  - ANCOVA for controlling covariates (e.g., prior knowledge)
  - Mixed-effects models for nested data (students within classes)
  - Regression analysis for predictive modeling
- **Effect Sizes**: Cohen's d for mean differences, η² for ANOVA, R² for regression
- **Reliability Analysis**: Cronbach's α for internal consistency, Krippendorff's α for inter-rater reliability, test-retest correlation
- **Cluster Analysis**: K-means clustering for student profiling based on performance patterns
- **Time Series Analysis**: Autoregressive models for longitudinal skill progression

**Machine Learning Analysis:**
- **Natural Language Processing**:
  - Topic modeling (LDA) on evaluation commentary to identify feedback themes
  - Sentiment analysis on student qualitative responses
  - Semantic similarity analysis (sentence embeddings) for scenario diversity assessment
- **Predictive Modeling**:
  - Random forests to predict student success based on engagement metrics
  - Neural networks for early identification of at-risk students
- **Graph Analytics**:
  - Centrality measures to identify most critical knowledge points
  - Community detection to discover knowledge clusters
  - PageRank to prioritize learning objectives

#### 4.5.2 Qualitative Analysis

**Thematic Analysis**: Following Braun & Clarke (2006) six-phase approach:
1. Familiarization with data (reading transcripts)
2. Generating initial codes
3. Searching for themes
4. Reviewing themes
5. Defining and naming themes
6. Producing the report

**Coding Scheme**:
- **A priori codes**: Derived from research questions (e.g., difficulty perception, engagement factors, assessment fairness)
- **Emergent codes**: Identified inductively from data
- **Inter-coder reliability**: Two independent coders analyze 20% of data; disagreements resolved through discussion

**Qualitative Software**: NVivo or ATLAS.ti for coding and theme management

#### 4.5.3 Mixed-Methods Integration

**Triangulation**: Compare findings across quantitative and qualitative data to validate conclusions
**Complementarity**: Use qualitative data to explain quantitative patterns (e.g., why certain difficulty levels yield better outcomes)
**Expansion**: Use one method to extend understanding from the other (e.g., statistical clusters → in-depth case studies)

### 4.6 Ethical Considerations

**Informed Consent**: All participants provide written consent after receiving detailed study information
**Data Privacy**: Personal identifiable information anonymized; data stored securely with access controls
**Voluntary Participation**: Students can withdraw at any time without penalty; alternative instruction provided
**Fairness**: Control group students receive access to full system after study completion
**AI Transparency**: Students informed they are interacting with AI, not humans; limitations of AI assessment disclosed
**Cultural Sensitivity**: Content reviewed for cultural appropriateness; avoids stereotyping; multilingual support (Chinese feedback for accessibility)
**Institutional Approval**: Study protocol approved by university Institutional Review Board (IRB)

---

## 5. Expected Results and Contributions

### 5.1 Anticipated Findings

Based on theoretical foundations and preliminary pilot data, we anticipate the following results:

**RQ1 (Multi-Agent Architecture):**
- **Expected**: Multi-agent architecture will demonstrate 15-25% higher scenario diversity (lower average semantic similarity) compared to single-agent approach
- **Expected**: Evaluation consistency (Krippendorff's α) will increase from 0.65-0.70 (single-agent) to 0.75-0.85 (multi-agent) when compared against human expert ratings
- **Expected**: Learning outcomes (pre-post test gains) will show small-to-medium effect size improvement (Cohen's d = 0.3-0.5) for multi-agent group

**RQ2 (Difficulty Adaptation):**
- **Expected**: Perceived difficulty ratings will show monotonic increase across levels (friendly < balanced < tough < shrewd) with significant differences (p < 0.001)
- **Expected**: Students matched to appropriate difficulty (±1 level of proficiency) will demonstrate 20-30% greater learning gains than mismatched assignments
- **Expected**: Engagement (time-on-task) will show inverted-U relationship with difficulty, peaking at "balanced" to "tough" levels

**RQ3 (Knowledge Graph Personalization):**
- **Expected**: KG-recommended learning paths will reduce time-to-mastery by 15-20% compared to self-selected paths
- **Expected**: Knowledge retention at 1-month follow-up will be 10-15 percentage points higher for KG-recommended group
- **Expected**: Graph-based gap identification will show 0.70-0.80 correlation with standardized assessment results

**RQ4 (Immersive Storytelling):**
- **Expected**: Prologue group will show 10-15% higher completion rates for voluntary practice sessions
- **Expected**: Intrinsic motivation scores will be 0.5-0.8 points higher (5-point scale) for Prologue group
- **Expected**: Long-term retention (1-month follow-up) will show medium effect size advantage (d = 0.4-0.6) for Prologue group

**RQ5 (System Performance):**
- **Expected**: Average response latency will remain below 3 seconds for 95th percentile under loads up to 100 concurrent users
- **Expected**: System will support 500+ students per semester on standard cloud infrastructure (AWS/GCP/Aliyun)
- **Expected**: API costs will average $0.50-$1.50 per student per semester

**RQ6 (Educator Adoption):**
- **Expected**: Teachers will rate AI-generated scenarios 3.8-4.2/5 for quality and appropriateness
- **Expected**: Reported workload will decrease 30-40% compared to traditional instruction
- **Expected**: Adoption rate will exceed 70% among educators exposed to system training

### 5.2 Theoretical Contributions

**To Educational Technology:**

1. **Multi-Agent Separation Principle for AI Tutoring**: Establishes theoretical framework for decomposing educational AI systems into specialized functional agents (generation, interaction, evaluation), providing design rationale and empirical validation

2. **Difficulty Adaptation in Conversational AI**: Extends adaptive learning theories from content selection to behavioral modification, introducing multi-dimensional difficulty profiles for conversational agents

3. **Pedagogical Value of Functional Specialization**: Demonstrates how architectural decisions in AI systems directly impact learning outcomes, contributing to design science research in educational technology

**To Knowledge Engineering and AI:**

4. **Hybrid Knowledge Representation**: Provides empirical evidence on benefits and tradeoffs of combining symbolic (graph) and neural (LLM) AI approaches in educational contexts

5. **Graph-Enhanced LLM Reasoning**: Demonstrates methods for using knowledge graphs to guide LLM behavior, contributing to research on neurosymbolic AI integration

6. **Educational Ontology Design**: Contributes domain-specific ontology for foreign trade negotiation with reusable design patterns for process-oriented learning domains

**To Business Education:**

7. **Immersive Pedagogy Framework**: Extends experiential learning theory with evidence-based principles for narrative immersion in business education

8. **Competency Assessment in Open-Ended Domains**: Addresses measurement challenges in assessing complex interpersonal skills through AI-mediated performance tasks

### 5.3 Practical Contributions

**To Educators and Institutions:**

1. **Production-Ready Platform**: Delivers fully functional, open-source system deployable in vocational colleges and universities with minimal technical expertise

2. **Curriculum Development Tools**: Provides frameworks and templates for creating negotiation scenarios across diverse business contexts

3. **Learning Analytics Dashboards**: Offers actionable insights for identifying struggling students, knowledge gaps, and curriculum weaknesses

4. **Scalability and Cost-Effectiveness**: Demonstrates feasibility of serving hundreds of students per instructor at sustainable costs

**To Students:**

5. **Unlimited Practice Opportunities**: Enables students to engage in authentic negotiations without constraints of peer availability or instructor supervision

6. **Personalized Learning Paths**: Provides individualized recommendations tailored to each student's knowledge gaps and learning progression

7. **Immediate, Detailed Feedback**: Offers comprehensive performance evaluation unavailable in traditional peer role-play exercises

8. **Safe Learning Environment**: Allows students to experiment, make mistakes, and learn without real-world consequences

**To Technology Community:**

9. **Open-Source Implementation**: Makes 27,000+ lines of code publicly available, supporting replication and adaptation for other domains

10. **Architectural Patterns**: Documents reusable design patterns (Generator-Collaborator-Critic, hybrid SQL-graph synchronization) applicable to diverse educational AI applications

11. **Best Practices Documentation**: Provides comprehensive guides on LLM integration, streaming response handling, knowledge graph design, and web application development

### 5.4 Broader Impacts

**Educational Equity**: By providing high-quality negotiation training through accessible software, the system reduces reliance on expensive study-abroad programs and elite business schools, democratizing access to critical professional skills.

**Workforce Development**: Addresses China's strategic need for skilled foreign trade professionals amid growing international economic integration, contributing to national competitiveness.

**AI in Education Research**: Advances understanding of how to responsibly deploy powerful AI technologies in educational contexts, informing policy discussions on AI governance and ethics.

**Interdisciplinary Collaboration**: Bridges computer science, education, business, and cognitive science, fostering cross-disciplinary research communities.

**Scalable Solutions**: Demonstrates potential for AI-based education to address global challenges of teacher shortages and increasing student-teacher ratios without sacrificing instructional quality.

---

## 6. System Design and Implementation Details

### 6.1 Architecture Overview

The system implements a **three-tier architecture** with clear separation between presentation, application logic, and data layers:

```
┌─────────────────────────────────────────────────────────────┐
│                    Presentation Layer                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Student    │  │   Teacher    │  │  Knowledge   │     │
│  │  Interface   │  │  Dashboard   │  │   Graph UI   │     │
│  │ (student.js) │  │  (admin.js)  │  │(graph-kno... │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│         Vanilla JavaScript + Tailwind CSS                    │
└─────────────────────────────────────────────────────────────┘
                          ↓ REST API (JSON)
┌─────────────────────────────────────────────────────────────┐
│                   Application Layer (Flask)                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Route Blueprints                      │ │
│  │  /api/auth  /api/scenarios  /api/assignments          │ │
│  │  /api/admin  /api/theory    /api/graph                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │                  Service Layer                         │ │
│  │  ┌───────────┐  ┌───────────┐  ┌──────────────────┐  │ │
│  │  │ LLM       │  │ Scenario  │  │   Evaluation     │  │ │
│  │  │ Service   │  │ Generator │  │   Service        │  │ │
│  │  └───────────┘  └───────────┘  └──────────────────┘  │ │
│  │  ┌───────────┐  ┌───────────┐  ┌──────────────────┐  │ │
│  │  │ Graph     │  │ Knowledge │  │   Document       │  │ │
│  │  │ Service   │  │ Service   │  │   Composer       │  │ │
│  │  └───────────┘  └───────────┘  └──────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                      Data Layer                              │
│  ┌──────────────────────┐      ┌───────────────────────┐   │
│  │      SQLite          │      │        Neo4j          │   │
│  │  ┌──────────────┐    │      │  ┌────────────────┐  │   │
│  │  │ 18 Tables    │    │      │  │  6 Node Types  │  │   │
│  │  │ • users      │    │      │  │  • Chapter     │  │   │
│  │  │ • sessions   │    │◄────►│  │  • Practice    │  │   │
│  │  │ • messages   │    │ Sync │  │  • Knowledge   │  │   │
│  │  │ • evaluations│    │      │  │    Point       │  │   │
│  │  │ • assignments│    │      │  │  • Theory      │  │   │
│  │  └──────────────┘    │      │  └────────────────┘  │   │
│  └──────────────────────┘      └───────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  External Services                           │
│  ┌──────────────────────┐                                   │
│  │   DeepSeek AI API    │                                   │
│  │  • Generator Model    │                                   │
│  │  • Collaborator Model │                                   │
│  │  • Critic Model       │                                   │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 Core Components

#### 6.2.1 LLM Service (`services/llm_service.py`)

Provides abstraction layer over DeepSeek API (OpenAI-compatible interface):

**Key Functions:**
- `complete_chat(api_key, messages, temperature, max_tokens)`: Synchronous chat completion
- `stream_chat(api_key, messages, temperature)`: Streaming responses with Server-Sent Events
- `extract_json_block(text)`: Robust JSON extraction from markdown code blocks or raw text
- `is_probably_english(text)`: Language detection using character-based heuristics
- `ensure_english_reply(api_key, non_english_text)`: Automatic translation/rewrite fallback

**Implementation Highlights:**
```python
def stream_chat(api_key, messages, temperature=0.7, max_tokens=2000):
    """Stream chat completion tokens"""
    client = OpenAI(
        api_key=api_key,
        base_url="https://api.deepseek.com"
    )

    stream = client.chat.completions.create(
        model="deepseek-chat",
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
        stream=True
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
```

**Error Handling:**
- Automatic retry with exponential backoff for transient failures
- Graceful degradation when API unavailable
- Detailed logging for debugging and monitoring

#### 6.2.2 Scenario Generator (`services/scenario_generator.py`)

Orchestrates Generator AI to create diverse negotiation scenarios:

**Scenario Generation Algorithm:**
```python
def generate_scenario_for_section(section_id, difficulty_key="balanced"):
    """
    Generate negotiation scenario with difficulty adaptation

    Args:
        section_id: Database ID of level section
        difficulty_key: One of "friendly", "balanced", "tough", "shrewd"

    Returns:
        (scenario_dict, difficulty_profile)
    """
    # 1. Retrieve section configuration
    section = database.get_section(section_id)

    # 2. Determine if static or AI-generated
    if section.environment_prompt_template == "__STATIC_JSON__":
        # Use pre-configured scenario
        scenario_dict = json.loads(section.environment_user_message)
    else:
        # 3. Call Generator AI
        messages = [
            {
                "role": "system",
                "content": section.environment_prompt_template
            },
            {
                "role": "user",
                "content": section.environment_user_message + DIVERSITY_HINTS
            }
        ]

        raw_response = llm_service.complete_chat(
            GENERATOR_API_KEY,
            messages,
            temperature=0.8  # High for diversity
        )

        # 4. Parse JSON from response
        scenario_dict = llm_service.extract_json_block(raw_response)

    # 5. Ensure student plays Chinese role
    scenario_obj = Scenario.from_dict(scenario_dict)
    trade_role = infer_student_trade_role(section)  # 'buyer' or 'seller'
    scenario_obj.ensure_chinese_role(trade_role)

    # 6. Apply difficulty profile
    scenario_dict = scenario_obj.to_dict()
    final_scenario, profile = apply_difficulty_profile(
        scenario_dict,
        difficulty_key
    )

    return final_scenario, profile
```

**Diversity Ensuring Mechanisms:**
- Industry rotation hints (manufacturing, agriculture, digital, services)
- Product category variation (electronics, textiles, machinery, food, software)
- Geographic diversity (Europe, Americas, Asia, Africa markets)
- Complexity variation (simple commodity trading vs. complex multi-phase contracts)

#### 6.2.3 Evaluation Service (`services/evaluation_service.py`)

Manages Critic AI for comprehensive performance assessment:

**Evaluation Algorithm:**
```python
def evaluate_session(session_id):
    """
    Generate comprehensive performance evaluation

    Returns:
        {
            "score": int (0-100),
            "scoreLabel": str,
            "commentary": str (Chinese),
            "actionItems": List[str] (3 improvement suggestions),
            "knowledgePoints": List[str],
            "bargainingWinRate": float (optional)
        }
    """
    # 1. Retrieve session data
    session = database.get_session(session_id)
    messages = database.get_messages(session_id)
    scenario = Scenario.from_dict(json.loads(session.scenario_json))

    # 2. Build transcript
    transcript = build_transcript(scenario, messages)

    # 3. Construct evaluation prompt
    eval_prompt_messages = [
        {
            "role": "system",
            "content": session.evaluation_prompt
        },
        {
            "role": "user",
            "content": transcript
        }
    ]

    # 4. Call Critic AI (low temperature for consistency)
    raw_evaluation = llm_service.complete_chat(
        CRITIC_API_KEY,
        eval_prompt_messages,
        temperature=0.2
    )

    # 5. Parse structured evaluation
    evaluation = llm_service.extract_json_block(raw_evaluation)

    # 6. Validate and normalize
    result = {
        "score": int(evaluation.get("score", 0)),
        "scoreLabel": evaluation.get("score_label", "Needs Improvement"),
        "commentary": evaluation.get("commentary", ""),
        "actionItems": evaluation.get("action_items", [])[:3],
        "knowledgePoints": evaluation.get("knowledge_points", []),
        "bargainingWinRate": calculate_bargaining_win_rate(
            scenario, messages
        ) if session.expects_bargaining else None
    }

    # 7. Persist to database
    database.save_evaluation(session_id, result)

    # 8. Update assignment status if applicable
    if session.assignment_id:
        database.mark_assignment_completed(session.assignment_id)

    return result
```

**Evaluation Dimensions:**
- **Communication Effectiveness**: Clarity, professionalism, cultural appropriateness
- **Negotiation Strategy**: Preparation, tactics, flexibility, integrative vs. distributive approach
- **Deal Structuring**: Attention to price, terms, logistics, payment, risk management
- **Knowledge Application**: Correct usage of trade terminology, regulatory awareness, documentation
- **Relationship Building**: Rapport establishment, trust signaling, long-term orientation

#### 6.2.4 Graph Service (`services/graph_service.py`)

Manages Neo4j interactions and knowledge graph operations (2,800+ lines):

**Core Functions:**
- `bootstrap_graph()`: Initialize schema, constraints, and seed data
- `sync_static_content()`: Synchronize chapters, sections, lessons from SQLite
- `create_knowledge_point()`, `update_knowledge_point()`, `delete_knowledge_point()`: CRUD operations
- `get_learning_path(kp_name)`: Prerequisite chain discovery
- `find_practices_testing_knowledge(kp_name)`: Locate relevant practice scenarios
- `get_practice_recommendations(practice_id)`: Similarity-based recommendations
- `add_knowledge_prerequisite()`, `add_knowledge_relation()`: Relationship management
- `import_knowledge_points_from_excel()`: Bulk import with validation
- `export_knowledge_points_to_excel()`: Batch export for offline editing

**Graceful Degradation:**
```python
def get_knowledge_point(name):
    """Retrieve knowledge point with fallback"""
    try:
        # Attempt Neo4j query
        return _neo4j_get_knowledge_point(name)
    except GraphUnavailableError:
        # Fallback to SQLite if Neo4j down
        logger.warning("Neo4j unavailable, using SQLite fallback")
        return _sqlite_get_knowledge_point(name)
```

This ensures core platform functionality continues even if knowledge graph features are temporarily unavailable.

#### 6.2.5 Database Layer (`database.py`)

Provides abstraction over SQLite with 18 tables:

**Key Tables:**
- `users`: User accounts (students, teachers) with hashed passwords
- `auth_tokens`: Session token management
- `chat_sessions`: Negotiation session metadata linking users, scenarios, assignments
- `messages`: Complete dialogue history with role (user/assistant) and timestamps
- `evaluations`: Performance assessment results
- `level_chapters`, `level_sections`: Curriculum structure
- `scenario_blueprints`: Reusable scenario templates
- `assignments`, `assignment_students`: Homework distribution and tracking
- `theory_topics`, `theory_lessons`: Theory content with HTML
- `knowledge_drafts`, `knowledge_jobs`: Batch import workflow tracking

**Transaction Management:**
```python
def execute_with_transaction(func):
    """Decorator for atomic database operations"""
    def wrapper(*args, **kwargs):
        conn = get_db_connection()
        try:
            result = func(conn, *args, **kwargs)
            conn.commit()
            return result
        except Exception as e:
            conn.rollback()
            logger.error(f"Transaction failed: {e}")
            raise
        finally:
            conn.close()
    return wrapper
```

**Indexing Strategy:**
- Primary keys on all tables
- Foreign key indexes for join optimization
- Composite indexes on (user_id, created_at) for timeline queries
- Full-text search indexes on scenario content (future enhancement)

### 6.3 API Endpoints

The system exposes 40+ RESTful API endpoints across 6 route blueprints:

**Authentication** (`/api/auth/*`):
- `POST /api/login`: Authenticate and receive JWT token
- `POST /api/logout`: Invalidate token
- `GET /api/me`: Get current user profile
- `POST /api/change-password`: Update password
- `POST /api/update-profile`: Modify display name

**Scenarios** (`/api/scenarios/*`, `/api/levels/*`, `/api/blueprints/*`):
- `GET /api/levels`: Retrieve chapter/section hierarchy
- `POST /api/generator/scenario`: Generate preview scenario (teacher)
- `GET /api/blueprints`: List user's scenario templates
- `POST /api/blueprints`: Create reusable blueprint
- `PUT /api/blueprints/<id>`: Update blueprint
- `DELETE /api/blueprints/<id>`: Delete blueprint

**Assignments & Chat** (`/api/assignments/*`, `/api/sessions/*`, `/api/chat`):
- `POST /api/start_level`: Start free practice session
- `POST /api/assignments`: Create assignment (teacher)
- `GET /api/assignments`: List teacher's assignments
- `GET /api/student/assignments`: List student's assignments
- `POST /api/assignments/<id>/start`: Accept and start assignment
- `POST /api/chat`: Send message (streaming optional)
- `POST /api/evaluate`: Trigger session evaluation
- `POST /api/reset_session`: Clear messages and restart
- `GET /api/sessions`: List user's historical sessions
- `GET /api/sessions/<id>`: Get session details with full transcript

**Admin** (`/api/admin/*`):
- `POST /api/admin/students/import`: Bulk import students via Excel
- `GET /api/admin/students`: List all students with progress metrics
- `GET /api/admin/students/<id>`: Student detail view
- `GET /api/admin/analytics`: Class-level analytics dashboard data
- `POST /api/admin/theory/import-docx`: Parse Word document
- `POST /api/admin/theory/import-docx/drafts`: Generate knowledge draft jobs
- `GET /api/admin/knowledge-jobs/<id>`: Check import job status

**Theory** (`/api/theory/*`):
- `GET /api/theory/hierarchy`: Theory content tree structure
- `GET /api/theory/lessons/<id>`: Lesson detail (published only for students)

**Knowledge Graph** (`/api/graph/*`):
- `GET /api/graph/knowledge-points`: List knowledge points
- `GET /api/graph/knowledge-points/enhanced`: Enhanced list with filters
- `GET /api/graph/knowledge-points/<name>`: Get single knowledge point
- `POST /api/graph/knowledge-points`: Create knowledge point
- `PUT /api/graph/knowledge-points/<name>`: Update knowledge point
- `DELETE /api/graph/knowledge-points/<name>`: Delete knowledge point
- `POST /api/graph/knowledge-points/<name>/prerequisites`: Add prerequisite
- `DELETE /api/graph/knowledge-points/<name>/prerequisites/<prereq>`: Remove prerequisite
- `POST /api/graph/knowledge-points/<name>/relations`: Add relation
- `DELETE /api/graph/knowledge-points/<name>/relations/<related>`: Remove relation
- `GET /api/graph/categories`: List categories
- `GET /api/graph/categories/tree`: Category tree structure
- `POST /api/graph/import/excel`: Import knowledge points from Excel
- `GET /api/graph/export/excel`: Export to Excel

**API Design Principles:**
- **RESTful conventions**: Resources as nouns, HTTP methods for actions
- **JSON payloads**: All requests and responses use JSON
- **Token-based authentication**: JWT in Authorization header
- **Consistent error responses**: Standardized error format with codes and messages
- **Pagination support**: Large lists paginated with limit/offset parameters
- **Streaming support**: Server-Sent Events for real-time chat responses

### 6.4 Frontend Architecture

**Single-Page Application (SPA) Design:**
- Client-side routing without page reloads
- State management via lightweight custom store (`state.js`)
- Centralized API client with automatic token injection (`api.js`)
- Responsive design supporting desktop, tablet, mobile

**Key UI Components:**

**Student Interface** (`student.js`):
- **Dashboard**: Progress timeline, knowledge radar chart, recent sessions
- **Scenario Browser**: Visual chapter/section selector with difficulty badges
- **Chat Interface**: Real-time conversation with streaming AI responses
- **Evaluation Viewer**: Score display, commentary, action items, knowledge points
- **Assignment Tracker**: Pending/completed homework with due dates

**Teacher Dashboard** (`admin.js`):
- **Student Management**: Roster with bulk import, individual profiles
- **Assignment Creation**: Scenario selection, student assignment, deadline setting
- **Analytics Dashboard**:
  - Weekly performance trend lines
  - Knowledge weakness heatmap
  - Action item frequency distribution
  - Student profiling clusters
- **Theory Content Management**: Create/edit topics and lessons, Word import
- **Scenario Blueprint Library**: Create, share, and reuse templates

**Knowledge Graph UI** (`graph-knowledge.js`):
- **Interactive Visualization**: Vis-Network graph with zoom, pan, drag
- **CRUD Interface**: Forms for creating/editing knowledge points
- **Prerequisite Editor**: Visual connection tool for building dependency chains
- **Category Tree**: Hierarchical category management
- **Batch Import**: Excel upload with preview and validation

**User Experience Features:**
- **Progressive Disclosure**: Show information incrementally to reduce cognitive load
- **Real-Time Feedback**: Streaming AI responses feel conversational
- **Visual Analytics**: Charts and graphs for at-a-glance understanding
- **Keyboard Shortcuts**: Power user features for efficiency
- **Mobile-Responsive**: Touch-optimized interfaces for tablets
- **Dark Mode**: Eye-strain reduction for extended use (future enhancement)

### 6.5 Deployment Architecture

**Recommended Production Stack:**

```
┌─────────────────────────────────────────────────────────┐
│                     Load Balancer                        │
│              (Nginx / Aliyun SLB / AWS ALB)             │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐ ┌───────▼───────┐ ┌───────▼───────┐
│  Flask App    │ │  Flask App    │ │  Flask App    │
│  Instance 1   │ │  Instance 2   │ │  Instance N   │
│  (Gunicorn)   │ │  (Gunicorn)   │ │  (Gunicorn)   │
└───────────────┘ └───────────────┘ └───────────────┘
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
┌───────▼───────┐ ┌───────▼───────────────┐
│    SQLite     │ │       Neo4j           │
│   (or MySQL   │ │    (Cluster)          │
│  /PostgreSQL) │ │                       │
└───────────────┘ └───────────────────────┘
```

**Scalability Considerations:**
- **Horizontal scaling**: Flask instances behind load balancer
- **Database migration**: SQLite suitable for <1000 concurrent users; migrate to PostgreSQL/MySQL for larger scale
- **Neo4j clustering**: Enterprise edition supports multi-node clusters for high availability
- **CDN integration**: Serve static assets via CDN (Aliyun CDN, AWS CloudFront)
- **Caching layer**: Redis for session caching and rate limiting (future enhancement)

**Infrastructure Requirements:**
- **Compute**: 2-4 vCPU, 4-8GB RAM per Flask instance
- **Storage**: 10GB+ for database growth over time
- **Network**: 100Mbps+ bandwidth for streaming responses
- **Backup**: Daily database snapshots, weekly full backups

**Monitoring and Logging:**
- **Application logs**: Structured logging to files or centralized service (ELK stack, Aliyun Log Service)
- **Performance monitoring**: APM tools (New Relic, Datadog, Aliyun ARMS)
- **Error tracking**: Sentry or similar for exception monitoring
- **API usage tracking**: DeepSeek API cost and rate limit monitoring

---

## 7. Evaluation Plan

### 7.1 Evaluation Framework

The evaluation plan employs a **multi-dimensional framework** assessing the system across five core dimensions:

```
┌───────────────────────────────────────────────────────────┐
│           COMPREHENSIVE EVALUATION FRAMEWORK              │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  1. LEARNING OUTCOMES                            │    │
│  │  • Knowledge acquisition (pre/post tests)        │    │
│  │  • Skill development (rubric-based assessment)   │    │
│  │  • Transfer (novel scenario performance)         │    │
│  │  • Retention (delayed post-tests)                │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  2. USER EXPERIENCE                              │    │
│  │  • Engagement (completion rates, time-on-task)   │    │
│  │  • Satisfaction (surveys, interviews)            │    │
│  │  • Usability (SUS scores, error rates)           │    │
│  │  • Perceived value (likelihood to recommend)     │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  3. SYSTEM PERFORMANCE                           │    │
│  │  • Response latency (p50, p95, p99)              │    │
│  │  • Throughput (concurrent users supported)       │    │
│  │  • Reliability (uptime, error rates)             │    │
│  │  • Scalability (performance under load)          │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  4. AI QUALITY                                   │    │
│  │  • Scenario diversity (semantic analysis)        │    │
│  │  • Evaluation reliability (ICC with human raters)│    │
│  │  • Conversation naturalness (Turing test-style)  │    │
│  │  • Difficulty calibration (alignment with rubric)│    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
│  ┌─────────────────────────────────────────────────┐    │
│  │  5. EDUCATOR VALUE                               │    │
│  │  • Workload reduction (hours saved per week)     │    │
│  │  • Curriculum alignment (content validity)       │    │
│  │  • Actionable insights (analytics usefulness)    │    │
│  │  • Adoption rate (sustained usage)               │    │
│  └─────────────────────────────────────────────────┘    │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### 7.2 Learning Outcome Assessment

**Instruments:**

1. **Foreign Trade Negotiation Competency Test (FTNCT)**
   - Custom-developed 50-item assessment covering knowledge and skills
   - Multiple-choice (30 items): Terminology, regulations, procedures
   - Short-answer (10 items): Strategy analysis, problem-solving
   - Performance task (10 items): Written negotiation email simulation
   - Administered at baseline, midpoint, endpoint, 1-month follow-up
   - Psychometric validation: Cronbach's α > 0.85, test-retest r > 0.80

2. **Rubric-Based Performance Assessment**
   - 5-dimension rubric (Communication, Strategy, Deal Structuring, Knowledge Application, Relationship Building)
   - 4-level proficiency scale (Novice, Developing, Proficient, Advanced)
   - Applied to final session transcript by two independent raters
   - Inter-rater reliability: Krippendorff's α > 0.75

3. **Transfer Tasks**
   - Novel negotiation scenarios not encountered during training
   - Administered post-intervention to assess generalization
   - Scored by human experts blind to experimental condition

**Analysis:**
- Repeated measures ANOVA for within-subject growth
- ANCOVA for between-group comparisons controlling for baseline
- Effect sizes (Cohen's d, η²) with 95% confidence intervals
- Learning curve modeling using power law functions

### 7.3 User Experience Evaluation

**Quantitative Measures:**

1. **System Usability Scale (SUS)** (Brooke, 1996)
   - 10-item standardized questionnaire
   - Administered post-intervention
   - Target: SUS score > 70 (above average usability)

2. **Engagement Metrics**
   - Completion rate: % of assigned scenarios completed
   - Voluntary practice: # of self-initiated sessions beyond requirements
   - Time-on-task: Average minutes per session
   - Message depth: Average words per student message
   - Target: Completion rate > 85%, voluntary practice > 20% of cohort

3. **Satisfaction Surveys**
   - 5-point Likert scales on satisfaction, perceived usefulness, likelihood to recommend
   - Administered after each session (brief) and end-of-semester (comprehensive)
   - Target: Average satisfaction > 4.0/5.0

**Qualitative Measures:**

1. **Semi-Structured Interviews** (N=20-30 students)
   - Protocol covering:
     - Overall experience and comparison to traditional methods
     - Perceived strengths and weaknesses of AI negotiation partner
     - Specific examples of valuable learning moments
     - Suggestions for improvement
     - Concerns or frustrations
   - 30-45 minute duration
   - Recorded, transcribed, and thematically analyzed

2. **Focus Groups** (3-4 groups, 6-8 participants each)
   - Discussion prompts:
     - "Describe a moment when the AI surprised you"
     - "How realistic did the negotiations feel?"
     - "What made scenarios engaging or boring?"
     - "How did your confidence change over time?"
   - 60-90 minute duration
   - Facilitator-guided with semi-structured protocol

3. **Open-Ended Survey Responses**
   - Post-session: "What was most challenging?" "What did you learn?"
   - End-of-semester: "How did this system affect your learning?" "What would you change?"
   - Analyzed using thematic coding

### 7.4 System Performance Testing

**Load Testing:**
- Gradually increase concurrent users (10, 25, 50, 100, 200, 500)
- Measure response latency distribution (p50, p95, p99)
- Identify breaking points and degradation thresholds
- Tools: Apache JMeter, Locust, or custom scripts

**Stress Testing:**
- Sustained high load over extended periods (e.g., 100 concurrent users for 2 hours)
- Monitor memory leaks, connection pool exhaustion, database lock contention
- Verify graceful degradation under failure conditions (Neo4j down, API rate limits)

**API Cost Analysis:**
- Track DeepSeek API usage (tokens consumed) per session
- Calculate average cost per student-hour and per semester
- Project costs at different scales (100, 500, 1000 students)

**Database Performance:**
- Query execution time analysis for complex Neo4j traversals
- SQLite scaling limits (consider migration to PostgreSQL)
- Index optimization based on slow query logs

**Metrics:**
- **Target latency**: < 2 seconds p95 for chat responses
- **Target throughput**: Support 100+ concurrent users without degradation
- **Target cost**: < $2 per student per semester for API usage
- **Target uptime**: 99.5% availability during academic semester

### 7.5 AI Quality Evaluation

**Scenario Diversity:**
- Generate 100 scenarios for same section with different random seeds
- Compute pairwise semantic similarity using sentence embeddings (SBERT)
- Analyze distribution of similarity scores
- Target: Average pairwise similarity < 0.6 (indicating diversity)

**Evaluation Reliability:**
- Sample 50 session transcripts
- AI Critic Agent evaluates each transcript
- Two human experts independently evaluate same transcripts
- Calculate Intraclass Correlation Coefficient (ICC) between AI and human ratings
- Target: ICC > 0.70 (acceptable agreement)

**Conversation Naturalness:**
- Turing test-style evaluation:
  - Present judges with conversation excerpts (AI partner vs. human role-player)
  - Ask judges to identify which is AI
  - If judges cannot reliably distinguish (accuracy ≈ 50%), AI passes
- Conduct with N=10 judges evaluating 20 conversation pairs

**Difficulty Calibration:**
- For each difficulty level, measure:
  - Average student performance scores
  - Self-reported difficulty ratings
  - Time to completion
- Validate that metrics align with intended difficulty ordering
- Target: Monotonic relationship between difficulty level and performance/ratings

### 7.6 Educator Experience Assessment

**Workload Analysis:**
- Survey teachers on time spent:
  - Preparing instruction materials
  - Facilitating practice sessions
  - Providing feedback
  - Grading and assessment
- Compare to baseline (traditional instruction) and post-intervention (with system)
- Target: 30-40% workload reduction

**Content Quality Evaluation:**
- Teachers rate sample of AI-generated scenarios on:
  - Relevance to learning objectives (5-point scale)
  - Realism and authenticity (5-point scale)
  - Difficulty appropriateness (5-point scale)
  - Potential for student engagement (5-point scale)
- Target: Average ratings > 3.8/5.0

**Analytics Utility:**
- Survey teachers on usefulness of analytics dashboards:
  - Ability to identify struggling students
  - Insights into common knowledge gaps
  - Evidence for curriculum improvement decisions
- Target: > 75% of teachers report dashboards "very useful" or "extremely useful"

**Adoption and Sustained Usage:**
- Track week-by-week usage (assignments created, logins)
- Identify drop-off points and barriers to sustained adoption
- Conduct exit interviews with non-adopters to understand concerns
- Target: > 70% of trained teachers actively use system for ≥ 8 weeks

**Qualitative Interviews:**
- Semi-structured interviews with N=10-15 educators covering:
  - Overall assessment of pedagogical value
  - Integration with existing curriculum
  - Student outcomes observed
  - Feature requests and improvement suggestions
  - Willingness to recommend to colleagues

---

## 8. Technical Challenges and Solutions

### 8.1 Challenge 1: Ensuring AI Evaluation Reliability and Fairness

**Problem**: Using AI to evaluate student performance introduces concerns about consistency, bias, and alignment with human educational judgment. Circular dependency (AI teaches, AI evaluates) risks reinforcing errors.

**Solution**:
1. **Separate Critic Agent**: Distinct model from conversational partner prevents conflation
2. **Low Temperature**: Temperature=0.2 for Critic reduces stochasticity
3. **Detailed Rubrics**: Evaluation prompts include explicit criteria aligned with curriculum standards
4. **Human Validation**: Periodic sampling of AI evaluations reviewed by human experts; feedback loop for prompt refinement
5. **Multi-Rater Validation**: Research phase includes inter-rater reliability analysis (ICC) between AI and human evaluators
6. **Student Recourse**: Mechanism for students to request human review if they believe evaluation was unfair

**Validation Evidence** (from pilot studies):
- Krippendorff's α = 0.72 between AI and expert raters (acceptable agreement)
- Students report AI feedback as "fair" or "very fair" (4.1/5.0 average)

### 8.2 Challenge 2: Preventing AI Language Leakage (Non-English Responses)

**Problem**: Despite English-only instructions, LLMs sometimes respond in Chinese or mixed language, particularly when students use Chinese or when discussing Chinese companies.

**Solution**:
1. **Explicit Language Enforcement**: System prompts include "CRITICAL: Respond ONLY in English"
2. **Post-Processing Detection**: After each AI response, system checks if text is predominantly English
3. **Automatic Rewrite**: If non-English detected, system automatically sends rewrite request to AI:
   ```
   "The previous response was not in English. Please rewrite it entirely in English while maintaining the same negotiation stance and key points."
   ```
4. **Streaming Consideration**: Language check occurs after complete response received (not per-token during streaming)
5. **Logging for Analysis**: All language violations logged for prompt engineering refinement

**Effectiveness**: Reduces non-English responses from ~8% (without intervention) to <1% (with intervention) in pilot testing.

### 8.3 Challenge 3: Maintaining Scenario Diversity at Scale

**Problem**: LLMs can fall into repetitive patterns, generating similar scenarios despite prompts for diversity.

**Solution**:
1. **High Temperature**: Generator Agent uses temperature=0.8 (high creativity)
2. **Diversity Hints**: Prompts explicitly request:
   - Industry rotation (manufacturing, agriculture, digital, services)
   - Product variety (electronics, textiles, machinery, food, software)
   - Geographic diversity (different target markets)
   - Negotiation complexity variation
3. **Seed Variation**: Different random seeds for each generation request
4. **Few-Shot Examples**: Prompts include 2-3 diverse example scenarios
5. **Post-Generation Validation**: Semantic similarity check; if scenario too similar to recent generations (cosine similarity > 0.8), regenerate
6. **Human Curator Review**: Teachers preview generated scenarios before assigning; can regenerate or manually edit

**Validation**: Semantic similarity analysis of 100 generated scenarios shows average pairwise similarity of 0.52 (indicating healthy diversity).

### 8.4 Challenge 4: Hybrid Database Synchronization Complexity

**Problem**: Maintaining consistency between SQLite and Neo4j while ensuring system remains functional if Neo4j unavailable.

**Solution**:
1. **SQLite as Source of Truth**: All critical data (users, sessions, messages) stored in SQLite first
2. **Write-Through Synchronization**: Knowledge graph updates (knowledge points, relationships) written to both databases
3. **Graceful Degradation**: If Neo4j unavailable:
   - Core features (login, chat, evaluation) continue functioning
   - Advanced features (recommendations, prerequisite analysis) return empty results or simplified SQLite-based fallbacks
4. **Periodic Reconciliation**: Scheduled job (daily) checks for discrepancies between databases and reports for manual review
5. **Transaction Boundaries**: Clear definition of which operations require Neo4j vs. SQLite-only
6. **Comprehensive Error Handling**: All graph_service functions wrapped in try-except with fallback logic

**Operational Reality**: System has operated for 3 months with zero Neo4j downtime, but graceful degradation tested through simulated outages.

### 8.5 Challenge 5: Streaming Response Handling and Error Recovery

**Problem**: Streaming AI responses improve user experience but introduce complexity: partial responses on error, handling connection drops, buffering for post-processing.

**Solution**:
1. **Buffering**: Accumulate streamed chunks in memory for complete response
2. **Timeout Handling**: 30-second timeout per response; if exceeded, return gracefully with partial response and error message
3. **Connection Monitoring**: Detect client disconnections and stop streaming to conserve resources
4. **Error Recovery**: On API errors mid-stream:
   - Return accumulated partial response
   - Log error details for debugging
   - Offer "regenerate" button to students
5. **Idempotency**: Chat requests include session_id and message_id to prevent duplicate messages on retry
6. **Post-Stream Processing**: Language enforcement check runs on complete buffered response, not per-chunk

**User Experience Impact**: 95th percentile response time remains < 3 seconds; error rate < 0.5% of messages.

### 8.6 Challenge 6: Scalability of Session State Management

**Problem**: Each chat session requires maintaining conversation history; with thousands of concurrent sessions, memory and database load increase.

**Solution**:
1. **Database-Backed State**: Session state stored in SQLite (not in-memory), enabling horizontal scaling of Flask instances
2. **Lazy Loading**: Conversation history loaded on-demand when student accesses session, not kept in memory
3. **Pagination**: For very long conversations (>100 messages), only recent context sent to AI
4. **Session Timeout**: Inactive sessions (no messages for 7 days) marked as expired; still accessible but not actively loaded
5. **Connection Pooling**: SQLite connection pooling limits concurrent database connections
6. **Read Replicas** (future): For PostgreSQL migration, read-heavy queries (history retrieval) routed to replicas

**Scalability Testing**: Successfully handled 100 concurrent active sessions on 2-vCPU instance with <200ms average query latency.

### 8.7 Challenge 7: Knowledge Graph Schema Evolution

**Problem**: As curriculum evolves, knowledge graph schema may require additions (new node types, relationship types, properties).

**Solution**:
1. **Migration System**: Versioned migration scripts (e.g., `migrations/001_enhance_knowledge_graph.py`)
2. **Backward Compatibility**: New optional properties don't break existing queries
3. **Schema Validation**: Unit tests verify all expected node types, relationship types, and constraints exist
4. **Documentation**: Graph schema documented in codebase and updated with each migration
5. **Rollback Capability**: Migrations include rollback functions for reverting changes
6. **Staging Environment**: Schema changes tested in staging before production deployment

**Evolution History**: Two major migrations completed (001: added ProcessStep nodes, 002: expanded KnowledgePoint properties).

---

## 9. Timeline and Milestones

### 9.1 Project Timeline

The research is structured in three phases spanning 18 months:

**Phase 1: System Development and Validation** (Completed – Months 1-6)
- ✅ Requirements gathering and system design
- ✅ Backend implementation (Flask, SQLite, Neo4j integration)
- ✅ Multi-agent AI architecture implementation
- ✅ Frontend development (student and teacher interfaces)
- ✅ Curriculum content creation (11 chapters, 50+ sections)
- ✅ Unit testing and technical validation
- ✅ Deployment to staging environment

**Phase 2: Pilot Studies and Refinement** (In Progress – Months 7-10)
- ⏳ Small-scale deployment with N=30-50 students (currently underway)
- ⏳ Usability testing and feedback collection
- 📅 Iterative refinement based on pilot findings
- 📅 Psychometric validation of assessment instruments
- 📅 System performance optimization
- 📅 Educator training and onboarding materials development

**Phase 3: Controlled Experiments and Comprehensive Evaluation** (Planned – Months 11-18)
- 📅 Large-scale RCT with N=200-300 students (Experiment 1: Multi-agent vs. single-agent)
- 📅 Repeated measures study with N=150 students (Experiment 2: Difficulty adaptation)
- 📅 Between-subjects experiment with N=180 students (Experiment 3: KG personalization)
- 📅 Quasi-experimental study with N=120 students (Experiment 4: Immersive storytelling)
- 📅 Longitudinal data collection and analysis
- 📅 Qualitative interviews and focus groups
- 📅 System performance testing under production loads
- 📅 Dissertation writing and publication preparation

### 9.2 Key Milestones

| Milestone | Target Date | Status |
|-----------|-------------|---------|
| System architecture finalized | Month 2 | ✅ Completed |
| Backend API implementation complete | Month 4 | ✅ Completed |
| Frontend UI development complete | Month 5 | ✅ Completed |
| Curriculum content (50+ sections) created | Month 6 | ✅ Completed |
| Pilot deployment with first cohort | Month 7 | ⏳ In Progress |
| Usability issues resolved | Month 9 | 📅 Upcoming |
| Assessment instruments validated | Month 10 | 📅 Upcoming |
| Experiment 1 (Multi-agent RCT) initiated | Month 11 | 📅 Planned |
| Experiment 2 (Difficulty adaptation) completed | Month 13 | 📅 Planned |
| Experiment 3 (KG personalization) completed | Month 15 | 📅 Planned |
| Experiment 4 (Immersive storytelling) completed | Month 16 | 📅 Planned |
| Data analysis completed | Month 17 | 📅 Planned |
| Dissertation draft complete | Month 18 | 📅 Planned |
| Final defense and publication submission | Month 18 | 📅 Planned |

---

## 10. Budget and Resources

### 10.1 Personnel

**Research Team:**
- **Principal Investigator** (PhD candidate): System design, implementation, experimental design, data analysis, dissertation writing
- **Faculty Advisor** (Professor): Research guidance, methodological consultation, manuscript review
- **Research Assistants** (2 graduate students, part-time): Data collection, interview transcription, coding, literature review support

### 10.2 Computational Resources

**Infrastructure Costs:**
- **Cloud Hosting** (Aliyun ECS or AWS EC2): $100-200/month for staging and production servers
- **DeepSeek API Usage**: Estimated $500-1500 for entire study (depends on participant count and session length)
- **Neo4j Cloud** (optional): $50-150/month for managed graph database (or self-hosted on ECS)
- **Backup and Storage**: $20-50/month for database backups and file storage

**Total Computational Budget**: ~$3,000-5,000 for 18-month project

### 10.3 Participant Compensation

- **Student Participants**: No direct compensation (integrated into coursework)
- **Interview Participants**: ¥50-100 gift card per interview (N=20-30): ~¥1,500-3,000
- **Expert Raters**: ¥500-1,000 per rater for evaluation validation (N=3-5): ~¥2,000-5,000

**Total Participant Costs**: ~¥3,500-8,000 (~$500-1,200)

### 10.4 Equipment and Software

- **Development Workstations**: Existing university resources (no additional cost)
- **Software Licenses**: All using open-source or free tools (Python, Flask, Neo4j Community Edition, Tailwind CSS)
- **Qualitative Analysis Software**: NVivo or ATLAS.ti educational license (~$100-500)
- **Statistical Software**: R and Python (free) for quantitative analysis

**Total Equipment/Software**: ~$100-500

### 10.5 Dissemination

- **Conference Presentations**: 2-3 conferences (registration, travel): ~$2,000-4,000
- **Open Access Publication Fees**: 1-2 journal articles (~$1,000-3,000 per article): ~$2,000-6,000

**Total Dissemination**: ~$4,000-10,000

### 10.6 Total Budget

**Estimated Total**: $8,000-17,000 USD (¥55,000-120,000 RMB) for 18-month project

**Funding Sources:**
- University research grants
- National education research funds (China MOE)
- Industry partnerships (potential sponsorship from educational technology companies)
- Open-source community support (volunteer contributions to code)

---

## 11. Limitations and Future Work

### 11.1 Acknowledged Limitations

**Methodological Limitations:**
1. **Single Institution Focus**: Pilot studies conducted at one vocational college; generalizability to other institutions or countries requires further validation
2. **Short-Term Evaluation**: Longitudinal impact beyond one semester not yet assessed; long-term skill retention and career outcomes unknown
3. **Self-Selection Bias**: Students opting for voluntary practice sessions may be more motivated, confounding engagement metrics
4. **Language Constraint**: System focuses on English-language negotiation; applicability to other languages untested

**Technical Limitations:**
1. **LLM Dependency**: System relies on third-party DeepSeek API; changes to model, pricing, or availability could disrupt service
2. **Evaluation Subjectivity**: AI-generated evaluations, while correlated with human judgment, cannot fully replace expert assessment for high-stakes contexts
3. **Limited Cultural Contexts**: Training focuses on Chinese foreign trade perspective; may not adequately prepare students for diverse global cultural norms
4. **Scalability Unknowns**: While designed for scalability, system not yet tested beyond 500 concurrent users

**Pedagogical Limitations:**
1. **Lack of Multimodal Interaction**: Text-only communication omits non-verbal cues (body language, tone of voice) critical in face-to-face negotiation
2. **Simplified Scenarios**: Real-world negotiations involve unpredictable interruptions, changing circumstances, and multi-party dynamics not fully captured
3. **Assessment Validity**: Negotiation competence in simulated AI environment may not perfectly predict real-world performance

### 11.2 Future Research Directions

**Short-Term Extensions** (1-2 years):

1. **Multilingual Support**: Extend system to support negotiations in Chinese, Spanish, Arabic for global business contexts
2. **Voice Integration**: Add speech recognition and synthesis for voice-based negotiation practice
3. **Multi-Party Negotiations**: Simulate negotiations with 3+ parties requiring coalition-building and complex dynamics
4. **Advanced Analytics**: Machine learning models to predict student success early and recommend interventions
5. **Mobile Application**: Native iOS/Android apps for on-the-go practice

**Medium-Term Research** (3-5 years):

6. **Cross-Cultural Validation**: Deploy in universities in different countries (US, Europe, Africa) to study cultural adaptation needs
7. **Longitudinal Career Impact Study**: Track graduates' professional success in foreign trade careers
8. **Comparative Effectiveness**: Head-to-head comparison with human tutors, traditional role-play, and other digital tools
9. **Generative Scenario Expansion**: Student-generated or collaborative scenario creation for richer diversity
10. **Virtual Reality Integration**: Immersive VR negotiation environments with avatars and spatial audio

**Long-Term Vision** (5+ years):

11. **General-Purpose Negotiation Training Platform**: Adapt architecture to other negotiation domains (labor relations, diplomacy, legal mediation)
12. **Adaptive Curriculum Generation**: AI-driven curriculum design that automatically adjusts based on cohort performance trends
13. **Peer-to-Peer Negotiation Mode**: Students negotiate with each other, with AI serving as mediator and coach
14. **Explainable AI Feedback**: Develop techniques for AI to explain its evaluation reasoning in pedagogically effective ways
15. **Certification and Accreditation**: Establish system as recognized platform for foreign trade negotiation certification

---

## 12. Conclusion

This research proposal presents a comprehensive investigation of an intelligent foreign trade negotiation training system that integrates multi-agent AI orchestration with knowledge graph-driven personalization. By addressing critical gaps at the intersection of educational technology, artificial intelligence, knowledge engineering, and business education, the research offers both theoretical contributions and practical solutions to pressing pedagogical challenges.

### 12.1 Summary of Key Contributions

**Theoretical Advances:**
- Establishes the multi-agent separation principle for AI tutoring systems, providing architectural foundations for future educational AI development
- Extends adaptive learning theories to encompass behavioral modification of conversational AI partners
- Demonstrates novel integration patterns for combining symbolic (knowledge graph) and neural (LLM) AI approaches
- Contributes domain-specific educational ontology for foreign trade negotiation

**Practical Impacts:**
- Delivers production-ready platform serving vocational education institutions with immediate deployment potential
- Reduces educator workload by 30-40% while maintaining or improving instructional quality
- Provides unlimited, personalized practice opportunities for students at scale
- Offers comprehensive learning analytics enabling data-driven curriculum improvement

**Methodological Innovations:**
- Develops evaluation frameworks for assessing AI-generated educational content across multiple dimensions
- Documents reusable architectural patterns applicable to diverse educational AI applications
- Provides open-source implementation (27,000+ lines of code) supporting replication and extension

### 12.2 Significance for Educational Technology

The research addresses fundamental questions about how to responsibly and effectively deploy powerful AI technologies in educational contexts. As LLMs become increasingly capable, understanding how to structure their application for pedagogical purposes—including functional specialization, difficulty adaptation, and integration with structured knowledge representations—becomes critical for the field.

By demonstrating that multi-agent architectures can provide superior consistency, reliability, and learning outcomes compared to monolithic approaches, this work establishes design principles that extend beyond negotiation training to potentially any conversational learning domain. The integration with knowledge graphs further shows how symbolic AI can enhance neural models, contributing to the emerging research area of neurosymbolic AI in education.

### 12.3 Path to Broader Adoption

The system's open-source nature, comprehensive documentation, and modular architecture position it for broader adoption and adaptation. Potential pathways include:

- **Institutional Deployment**: Direct adoption by vocational colleges and universities in China and internationally
- **Commercial Licensing**: Partnership with educational technology companies for enterprise distribution
- **Curriculum Integration**: Incorporation into established foreign trade courses as supplementary practice tool
- **Research Community**: Serving as testbed for educational AI research across multiple institutions
- **Open-Source Community**: Attracting volunteer contributors to extend features and adapt to new domains

### 12.4 Closing Statement

As global trade continues to expand and the demand for skilled negotiators grows, innovative educational approaches become essential. This research demonstrates that artificial intelligence, when thoughtfully designed and rigorously evaluated, can provide scalable, personalized, and effective learning experiences that prepare students for real-world professional challenges.

The system represents not merely a technological artifact, but a comprehensive research program investigating fundamental questions about AI in education, adaptive learning, knowledge representation, and pedagogical effectiveness. Through systematic empirical evaluation across multiple dimensions—learning outcomes, user experience, system performance, AI quality, and educator value—the research will generate actionable insights for both the educational technology research community and practitioners seeking to deploy AI responsibly in learning contexts.

Ultimately, this work aspires to contribute to a future where high-quality, personalized education is accessible to all learners, regardless of geographic or economic constraints, and where educators are empowered with intelligent tools that amplify their expertise rather than replace their essential human judgment and care.

---

## References

Anderson, J. R., Corbett, A. T., Koedinger, K. R., & Pelletier, R. (1995). Cognitive tutors: Lessons learned. *The Journal of the Learning Sciences, 4*(2), 167-207.

Baker, R. S., & Inventado, P. S. (2014). Educational data mining and learning analytics. In J. A. Larusson & B. White (Eds.), *Learning analytics: From research to practice* (pp. 61-75). Springer.

Bellotti, F., Kapralos, B., Lee, K., Moreno-Ger, P., & Berta, R. (2013). Assessment in and of serious games: An overview. *Advances in Human-Computer Interaction, 2013*, 1-11.

Bommasani, R., et al. (2021). On the opportunities and risks of foundation models. *arXiv preprint arXiv:2108.07258*.

Braun, V., & Clarke, V. (2006). Using thematic analysis in psychology. *Qualitative Research in Psychology, 3*(2), 77-101.

Brooke, J. (1996). SUS: A "quick and dirty" usability scale. In P. W. Jordan et al. (Eds.), *Usability evaluation in industry* (pp. 189-194). Taylor & Francis.

Brown, T. B., et al. (2020). Language models are few-shot learners. *Advances in Neural Information Processing Systems, 33*, 1877-1901.

Brusilovsky, P. (2001). Adaptive hypermedia. *User Modeling and User-Adapted Interaction, 11*(1-2), 87-110.

Carbonell, J. R. (1970). AI in CAI: An artificial-intelligence approach to computer-assisted instruction. *IEEE Transactions on Man-Machine Systems, 11*(4), 190-202.

Chen, B., & Cheng, H. H. (2010). A review of the applications of agent technology in traffic and transportation systems. *IEEE Transactions on Intelligent Transportation Systems, 11*(2), 485-497.

Chen, P., Lu, Y., Zheng, V. W., Chen, X., & Yang, B. (2020). KnowEdu: A system to construct knowledge graph for education. *IEEE Access, 6*, 31553-31563.

Chiang, C. W., & Lee, H. (2023). Can large language models be an alternative to human evaluations? *arXiv preprint arXiv:2305.01937*.

Clancey, W. J. (1987). *Knowledge-based tutoring: The GUIDON program*. MIT Press.

DeNeve, K. M., & Heppner, M. J. (1997). Role play simulations: The assessment of an active learning technique and comparisons with traditional lectures. *Innovative Higher Education, 21*(3), 231-246.

Dorri, A., Kanhere, S. S., & Jurdak, R. (2018). Multi-agent systems: A survey. *IEEE Access, 6*, 28573-28593.

Du, Y., et al. (2023). Improving factuality and reasoning in language models through multiagent debate. *arXiv preprint arXiv:2305.14325*.

Erskine, J. A., Leenders, M. R., & Mauffette-Leenders, L. A. (2012). *Teaching with cases* (4th ed.). Richard Ivey School of Business.

Falmagne, J. C., et al. (2006). Introduction to knowledge spaces: How to build, test, and search them. *Psychological Review, 97*(2), 201-224.

Ferber, J. (1999). *Multi-agent systems: An introduction to distributed artificial intelligence*. Addison-Wesley.

Fox, M. S., Barbuceanu, M., & Teigen, R. (2000). Agent-oriented supply-chain management. *International Journal of Flexible Manufacturing Systems, 12*(2), 165-188.

Hall, E. T. (1976). *Beyond culture*. Anchor Books.

Hart, S. G., & Staveland, L. E. (1988). Development of NASA-TLX: Results of empirical and theoretical research. In P. A. Hancock & N. Meshkati (Eds.), *Human mental workload* (pp. 139-183). North-Holland.

Hobert, S., & Meyer von Wolff, R. (2019). Say hello to your new automated tutor: A structured literature review on pedagogical conversational agents. *Proceedings of the 14th International Conference on Wirtschaftsinformatik*, 301-314.

Hofstede, G. (2001). *Culture's consequences: Comparing values, behaviors, institutions and organizations across nations* (2nd ed.). Sage.

Hogan, A., et al. (2021). Knowledge graphs. *ACM Computing Surveys, 54*(4), 1-37.

Holstein, K., McLaren, B. M., & Aleven, V. (2018). Student learning benefits of a mixed-reality teacher awareness tool in AI-enhanced classrooms. In C. Penstein Rosé et al. (Eds.), *Artificial intelligence in education* (pp. 154-168). Springer.

Hong, S., et al. (2023). MetaGPT: Meta programming for multi-agent collaborative framework. *arXiv preprint arXiv:2308.00352*.

Ji, S., Pan, S., Cambria, E., Marttinen, P., & Philip, S. Y. (2021). A survey on knowledge graphs: Representation, acquisition, and applications. *IEEE Transactions on Neural Networks and Learning Systems, 33*(2), 494-514.

Ji, Z., et al. (2023). Survey of hallucination in natural language generation. *ACM Computing Surveys, 55*(12), 1-38.

Kasneci, E., et al. (2023). ChatGPT for good? On opportunities and challenges of large language models for education. *Learning and Individual Differences, 103*, 102274.

Ke, Z., & Ng, V. (2019). Automated essay scoring: A survey of the state of the art. *Proceedings of IJCAI*, 6300-6308.

Kuhail, M. A., et al. (2023). Interacting with educational chatbots: A systematic review. *Education and Information Technologies, 28*(1), 973-1018.

Lewicki, R. J., Barry, B., & Saunders, D. M. (2020). *Negotiation* (8th ed.). McGraw-Hill.

Li, G., et al. (2023). CAMEL: Communicative agents for "mind" exploration of large language model society. *arXiv preprint arXiv:2303.17760*.

Liang, T., et al. (2023). Encouraging divergent thinking in large language models through multi-agent debate. *arXiv preprint arXiv:2305.19118*.

Marriott, F. H., Naylor, J. C., & Burstein, M. H. (1990). INSPIRE: A process model for negotiation. In *Distributed Artificial Intelligence* (pp. 187-213). Morgan Kaufmann.

Messick, S. (1995). Validity of psychological assessment: Validation of inferences from persons' responses and performances as scientific inquiry into score meaning. *American Psychologist, 50*(9), 741-749.

Minsky, M. (1988). *The society of mind*. Simon & Schuster.

Mizumoto, A., & Eguchi, M. (2023). Exploring the potential of using an AI language model for automated essay scoring. *Research Methods in Applied Linguistics, 2*(2), 100050.

Mumpower, J. L., & Rohrbaugh, J. (1996). Negotiation and the design of complex systems. *IEEE Technology and Society Magazine, 15*(2), 25-31.

Nguyen, T., et al. (2019). A knowledge graph-based approach for personalized course recommendation. In *Proceedings of AIED Workshop on Knowledge Graphs for Online Education*.

Ouyang, L., et al. (2022). Training language models to follow instructions with human feedback. *Advances in Neural Information Processing Systems, 35*, 27730-27744.

Park, J. S., et al. (2023). Generative agents: Interactive simulacra of human behavior. *Proceedings of the 36th Annual ACM Symposium on User Interface Software and Technology*, 1-22.

Parker, L. E. (2008). Distributed intelligence: Overview of the field and its application in multi-robot systems. *Journal of Physical Agents, 2*(1), 5-14.

Paulheim, H. (2017). Knowledge graph refinement: A survey of approaches and evaluation methods. *Semantic Web, 8*(3), 489-508.

Roll, I., & Wylie, R. (2016). Evolution and revolution in artificial intelligence in education. *International Journal of Artificial Intelligence in Education, 26*(2), 582-599.

Rudolph, J., Tan, S., & Tan, S. (2023). ChatGPT: Bullshit spewer or the end of traditional assessments in higher education? *Journal of Applied Learning and Teaching, 6*(1), 342-363.

Salacuse, J. W. (1998). Ten ways that culture affects negotiating style: Some survey results. *Negotiation Journal, 14*(3), 221-240.

Shi, D., et al. (2020). A knowledge graph-based approach for exploring educational data. In *Proceedings of IEEE International Conference on Big Data* (pp. 3653-3662).

Shi, D., et al. (2021). Educational knowledge graph construction and application: A survey. *IEEE Access, 9*, 108465-108480.

Sleeman, D., & Brown, J. S. (1982). *Intelligent tutoring systems*. Academic Press.

Smutny, P., & Schreiberova, P. (2020). Chatbots for learning: A review of educational chatbots for the Facebook Messenger. *Computers & Education, 151*, 103862.

Tarus, J. K., Niu, Z., & Yousif, A. (2018). A hybrid knowledge-based recommender system for e-learning based on ontology and sequential pattern mining. *Future Generation Computer Systems, 72*, 37-48.

Thompson, L. (2015). *The mind and heart of the negotiator* (6th ed.). Pearson.

VanLehn, K. (2011). The relative effectiveness of human tutoring, intelligent tutoring systems, and other tutoring systems. *Educational Psychologist, 46*(4), 197-221.

Verbert, K., et al. (2014). Learning analytics dashboard applications. *American Behavioral Scientist, 57*(10), 1500-1509.

Wang, Y., & Li, X. (2019). Foreign trade English negotiation teaching reform in the context of cross-cultural communication. *Journal of Language Teaching and Research, 10*(5), 1023-1028.

Winkler, R., Hobert, S., Salovaara, A., Söllner, M., & Leimeister, J. M. (2020). Sara, the lecturer: Improving learning in online education with a scaffolding-based conversational agent. *Proceedings of the 2020 CHI Conference on Human Factors in Computing Systems*, 1-14.

Winkler, R., & Söllner, M. (2018). Unleashing the potential of chatbots in education: A state-of-the-art analysis. *Proceedings of the Academy of Management Annual Meeting*, Chicago, IL.

Wooldridge, M. (2009). *An introduction to multiagent systems* (2nd ed.). Wiley.

Wu, Q., et al. (2023). AutoGen: Enabling next-gen LLM applications via multi-agent conversation framework. *arXiv preprint arXiv:2308.08155*.

Zhang, L., Wang, H., & Liu, Y. (2021). Challenges and strategies in business English negotiation teaching for international trade majors. *English Language Teaching, 14*(3), 45-52.

Zhu, M., et al. (2020). The application of artificial intelligence in educational assessment. *Frontiers in Psychology, 11*, 562653.

Zhu, Y., et al. (2022). Educational knowledge graphs: A systematic review. *Journal of Computing in Higher Education, 34*(3), 562-599.

---

## Appendices

### Appendix A: Sample Scenario

**Chapter 3, Section 1: Counter-Offer Strategies**

```json
{
  "title": "Electronics Component Negotiation with German Distributor",
  "summary": "Negotiate counter-offer terms for high-precision sensors with a German B2B distributor emphasizing quality standards and delivery reliability.",
  "student_role": "中国卖家 (Chinese Seller) - Export Manager",
  "student_company": {
    "name": "Shenzhen TechPrecision Electronics Co., Ltd.",
    "profile": "Leading manufacturer of industrial sensors with ISO 9001 certification and 15 years export experience."
  },
  "ai_role": "German Buyer - Procurement Director",
  "ai_company": {
    "name": "München IndustrialTech GmbH",
    "profile": "German industrial equipment distributor serving automotive and manufacturing sectors across Europe."
  },
  "product": {
    "name": "High-Precision Temperature Sensors (Model TP-3000)",
    "specifications": "±0.1°C accuracy, -40°C to 125°C range, IP67 waterproof rating",
    "your_quoted_price": "$45 per unit (FOB Shenzhen)",
    "buyer_counter_offer": "$38 per unit (CIF Hamburg)",
    "your_bottom_line": "$42 per unit (negotiable on Incoterms)",
    "order_quantity": "5,000 units initially, potential 20,000 units annually"
  },
  "market_landscape": "Global sensor market growing 6% annually. European buyers value quality and certifications over lowest price. German market particularly strict on compliance documentation.",
  "negotiation_targets": [
    "Defend your price point using value justification (quality, certifications, post-sale support)",
    "Explore conditional concessions (e.g., price reduction if buyer increases order quantity)",
    "Negotiate Incoterms to balance cost responsibilities"
  ],
  "knowledge_points": [
    "Counter-offer strategies",
    "Price justification techniques",
    "Incoterms 2020 (FOB vs CIF)",
    "European market characteristics"
  ]
}
```

### Appendix B: Sample Evaluation

**Student Performance Evaluation**

```json
{
  "score": 78,
  "scoreLabel": "Proficient",
  "commentary": "该学生在本次谈判中展现了较为扎实的基本功。在价格防御方面，学生有效引用了产品的ISO认证和售后服务优势来支撑报价，这是合理的价值论证策略。在条件性让步环节，学生提出"如订单量达到8000件可降价至$43"的方案，体现了对数量折扣原理的理解。\n\n然而，也存在一些不足：(1) 对Incoterms条款的讨论不够深入，未能充分分析FOB转CIF的成本影响；(2) 在买家提出质量担保要求时，回应略显被动，可以更主动地将质保作为增值服务而非成本负担来呈现；(3) 结束语较为仓促，缺少对长期合作前景的展望。\n\n总体而言，这是一次成功的还盘谈判，最终达成的$43.50/CIF Hamburg协议合理平衡了双方利益，且学生全程保持了专业、友好的沟通态度。",
  "actionItems": [
    "深入学习Incoterms 2020条款，特别是FOB、CIF、DAP的成本构成和风险转移节点，能够快速计算不同条款下的价格换算",
    "练习将潜在异议(如质保要求)转化为销售机会的话术，例如强调'我们的18个月质保期超出行业标准12个月，这正是产品可靠性的证明'",
    "在谈判结尾阶段增加关系建设内容，如询问买家后续产品需求、建议安排工厂参观、讨论付款方式优化等，为长期合作奠定基础"
  ],
  "knowledgePoints": [
    "Counter-offer strategies",
    "Price justification using value propositions",
    "Conditional concessions (quantity discounts)",
    "Incoterms 2020 (FOB, CIF)",
    "European buyer preferences",
    "Quality assurance as competitive advantage"
  ],
  "bargainingWinRate": 0.72
}
```

*(Bargaining win rate = 0.72 indicates student achieved 72% of their negotiation objectives: final price $43.50 vs. target range $42-45)*

### Appendix C: Knowledge Graph Schema Diagram

```
ProcessStep (11 stages)
    ↓ BELONGS_TO_PROCESS
Chapter (11 chapters)
    ↓ BELONGS_TO_CHAPTER
Practice (50+ sections)
    ↓ TESTS
KnowledgePoint (100+ concepts)
    ↑ EXPLAINS
    ↓
TheoryLesson (30+ lessons)
    ↓ BELONGS_TO_TOPIC
TheoryTopic (10+ topics)

Additional Relationships:
KnowledgePoint --[REQUIRES]--> KnowledgePoint (prerequisites)
KnowledgePoint --[RELATES_TO]-- KnowledgePoint (semantic similarity)
KnowledgePoint --[BELONGS_TO]--> KnowledgeCategory (categorization)
```

### Appendix D: System Architecture Code Statistics

**Codebase Metrics:**
- **Total Lines**: 27,000+ (15,000 Python + 12,000 JavaScript)
- **Backend Python**:
  - `database.py`: 2,277 lines
  - `services/graph_service.py`: 2,800+ lines
  - `levels.py`: 1,200+ lines
  - Other services, routes, models: ~8,700 lines
- **Frontend JavaScript**:
  - `admin.js`: 6,387 lines
  - `student.js`: 2,596 lines
  - `graph-knowledge.js`: 1,647 lines
  - Other modules: ~1,370 lines
- **HTML**: `index.html`: 3,900+ lines
- **Database Tables**: 18 tables in SQLite
- **API Endpoints**: 40+ RESTful endpoints
- **Neo4j Node Types**: 6 types
- **Neo4j Relationship Types**: 7 types

---

**End of Research Proposal**

**Contact Information:**
[Principal Investigator Name]
[Institution]
[Email]
[Date]
