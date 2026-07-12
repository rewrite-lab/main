---
title: "[ENG] How does Spring work? - Deep Research of Spring"
date: 2025-09-24 18:53:45
tags:
  - Research
  - Spring
  - Java
  - CVE
  - English
  - Security
  - Web
language: en
author: One, Predic, secu23
thumbnail: "/images/thumbnail/deep_research_spring.png"
copyright: |
  © 2025 HSPACE (References) Author: Rewrite Lab (도원준, 김민찬, 김동한)
  This copyright applies to this document only.
---

# TL;DR

---

Spring is a web application framework ecosystem that runs on the JVM. The first release was in 2003 under the Apache 2.0 License with Spring 1.0, introduced as an alternative to address the complexity and productivity issues of J2EE/EJB at the time. Since then, Spring has rapidly grown with numerous releases and additional technologies, and in particular, it has become one of the most widely used web frameworks in South Korea, with many companies adopting it.

![2025 StackOverFlow Web Frameworks Survey](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image.png)

2025 StackOverFlow Web Frameworks Survey

Spring provides a range of built-in security technologies. At its core is Spring Security, which supports authentication/authorization control, XSS defense, CSRF protection, and various security policies that make it convenient for companies to adopt. As a result, from an attacker’s perspective, targeting Spring-based services is relatively difficult. Compared to other frameworks, there are fewer attack vectors, and vulnerabilities are harder to find. Through this research, Rewrite aims to examine how Spring operates, investigate and analyze recent CVEs, review existing attack scenarios, and identify potential new attack vectors.

# Spring vs Spring boot vs Spring Security

---

## Spring

### Background

Spring is a lightweight IoC container and a comprehensive application framework for Java/Kotlin applications. It builds applications based on POJOs (Plain Old Java Objects) and eliminates unnecessary complexity in code, reducing overall code complexity. As an open-source framework, its purpose is to lower coupling between objects and ensure maintainability and testability through dependency injection and AOP (Aspect-Oriented Programming). The following chapter explains the components of Spring.

### Components and Features

The Spring framework is composed of around 20 modules. When organized in a tree structure, these modules are arranged as follows.

```
Spring Framework
├── Core Container
│   ├── Beans
│   ├── Core
│   ├── Context
│   └── Expression Language (SpEL)
├── Data Access / Integration
│   ├── JDBC
│   ├── ORM
│   ├── JMS
│   └── Transactions
├── Web
│   ├── Web (Servlet Based)
│   ├── Web MVC
│   └── WebSocket, WebFlux, etc
├── AOP (Aspect Oriented Programming)
└── Testing
```

![Diagram of the Main Module Hierarchy](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%201.png)

Diagram of the Main Module Hierarchy

**Core Container(Core Spring)**

The Core Container consists of the Core, Beans, Context, and Expression Language modules.

Core, Beans

- Provide the core functionalities of the framework, such as IoC and DI
  - IoC (Inversion of Control): The inversion of the control of object lifecycles
  - DI (Dependency Injection): Injecting dependencies (such as objects or classes) into a component (Class-in-Class)

Context

Building on the solid foundation provided by the Core and Beans modules, the framework offers a consistent API that allows easy retrieval of objects. This approach is similar to the `JNDI registry` mechanism.

```c
DataSource ds = (DataSource) ctx.lookup("java:/comp/env/jdbc/MyDB"); // Original JNDI
```

`Spring ApplicationContext`

```c
ApplicationContext ctx = …;
UserService svc = ctx.getBean("userService", UserService.class);
```

Expression Language

SpEL (Spring Expression Language) is the expression module that supports exploring and manipulating object graphs at runtime, setting and retrieving property values, performing property assignments, providing context support, and looking up objects by name within the Spring IoC container.

---

**Data Access / Integration**

The data access/integration layer consists of the JDBC, ORM, OXM, JMS, and Transaction modules.

**JDBC Abstraction Layer**

- Provides abstractions such as `JdbcTemplate`, implementing the template method pattern to reduce repetitive code
- Converts DBMS-specific error codes into common exception classes, allowing consistent error handling

**ORM**

- Provides an integration layer for object-relational mapping APIs

**OXM**

- Offers an abstraction layer supporting object/XML mapping implementations

**JMS**

- Provides functionality for creating and consuming messages

**Transaction Module**

- Delivers a consistent abstraction for both programmatic and declarative transaction management across special interface implementations and all POJOs
- Supports the `DataAccessException` hierarchy and transaction synchronization storage with JCA functionality

---

**AOP / Instrumentation**

**AOP**

- Spring provides rich support for aspect-oriented programming (AOP) through the AOP module, helping to reduce coupling between objects
- Achieved by separating logic using method interceptors and pointcuts

**Instrumentation**

- Provides the ability to add agents to the JVM
- Includes a weaving agent for Tomcat, which transforms class files as they are loaded by the Tomcat class loader

---

**Web(MVC / Remoting)**

**Web**

- Provides basic web integration features such as multipart file upload, Servlet Listener, and IoC container initialization using a web-oriented application context

**Web Servlet**

- Includes Spring’s implementation of MVC

**Web Struts**

- Provides support classes for integrating the classic Struts web layer with Spring (support discontinued from version 3.0)

**Web Portlet**

- Offers an MVC implementation for the Portlet environment
- Reflects the functionality of the Web Servlet module

---

### POJO (Plain Old Java Objects)

POJO itself is not a framework feature, but it can be considered the core of the development model that Spring pursues. One of Spring’s most important characteristics is enabling POJO-based programming, which can even be regarded as its foundation.

**POJO**

- Refers to plain Java objects with little to no special conventions, inheritance, or annotations
- Typically implemented as a `public class` in the form of a regular class
- IoC/DI, AOP, and PSA are provided to support POJO-based programming

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%202.png)

IoC(Inversion of Control)

- A design principle in which the framework controls the application flow, allowing developers to focus solely on business logic

```java
Service s = new Service(new Dao());
s.process();
```

Normally, objects would have to be created directly using `new` as shown above.

```java
@Component
class Service {
    private final Dao dao;
    Service(Dao dao) { this.dao = dao; }
}

```

By applying IoC as shown above, dependencies can be declared only through the constructor. In other words, IoC means that Spring, not the developer, creates the objects required by a specific class and establishes their dependencies.

![Spring IoC container](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%203.png)

Spring IoC container

**DI (Dependency Injection)**

- A design technique where an object’s dependencies are not created directly but are injected externally, as shown above
- DI is the mechanism used to implement the IoC principle

**AOP (Aspect-Oriented Programming)**

- Separates core logic from cross-cutting concerns and injects them automatically at desired points at runtime using proxies or bytecode manipulation
- Cross-cutting functionalities are separated into distinct objects (Aspects)
- Developers can write clean core logic, while shared logic is centrally managed in the separated Aspect

**PSA (Portable Service Abstraction)**

- In Spring, switching from one database to another can be done while keeping the usage method the same
- This is possible because Spring provides abstract service interfaces, commonly referred to as JDBC
- Database vendors implement their code based on JDBC, and this abstraction of services for consistent use is called PSA

## Spring Boot

### Background

Spring Boot provides an environment where applications can be run instantly through features such as auto-configuration and an embedded launcher (e.g., Tomcat). In contrast, the traditional Spring Framework required developers to manually configure the application context, servlet settings, and dependency management, which created a high entry barrier for initial development. Spring Boot removes this barrier and offers a variety of developer conveniences to make setting up the Spring environment easier. In essence, Spring Boot can be seen as a separate framework that simplifies the necessary configuration when building applications with Spring.

### Components and Features

- **Auto-configuration**: Most configurations are automatically applied without explicit developer setup
- **Starter dependencies**: Bundled dependency packages designed for specific purposes
- **Embedded Tomcat**: Provides embedded Tomcat or Jetty, enabling standalone execution without WAR deployment
- **Production-ready Actuator**: Includes operational tools such as health checks and log viewing
- **Quick configuration**: Supports fast setup using `application.yml` or `application.properties`

---

## Spring Security

### Background

Spring Security is a security framework that adds authentication and authorization capabilities to Spring applications. It provides built-in patterns for implementing authentication/authorization and supports various authentication mechanisms such as session-based login, OAuth2, and JWT. It also delivers core features necessary for web application security, including URL access control, method-level authorization checks, CSRF protection, and security header configuration. Because of these characteristics, Spring Security is almost always adopted to enhance the security of Spring applications. However, vulnerabilities can sometimes arise within the very framework introduced for security, which will be discussed in the CVE chapter.

### Components and Features

- **Authentication / Authorization**: Manages user authentication and access control
- **Filter**: Similar to middleware; servlet filters intercept the request/response flow; operates at the servlet container level and executes sequentially via a FilterChain
- **SecurityContextHolder**: Stores the security context of the current user
- **PasswordEncoder**: Handles password encryption, e.g., Bcrypt
- **UserDetails / UserDetailsService**: Interfaces for retrieving user information
- **CSRF, CORS, Session**: Provides built-in support for standard web security settings

Additionally, Spring Security is built on four core concepts:

- Authentication
- Authorization
- Password storage
- Servlet filter

To use Spring Security, you need to add the following dependency to your `pom.xml` (for Maven).

```xml
<properties>
       <spring-security.version>6.4.0</spring-security.version>
       <spring.version>6.1.0</spring.version>
</properties>
```

```xml
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-core</artifactId>
</dependency>
```

The following is a diagram of the Spring Security architecture.

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%204.png)

The following is a diagram of the internal structure of Spring Security.

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%205.png)

# Spring Build

---

Spring can be built easily using various build tools. During application development, it is often necessary to download and manage many external libraries. By using build tools, developers only need to specify the type and version of each library, and the tool automatically downloads and manages them (similar to Python’s `pip`). The most commonly used tools for this purpose are Maven and Gradle. This chapter introduces both tools and explains their respective build processes.

## Maven

Maven is a traditional build and project management tool created by Apache, based on declarative XML (`pom.xml`).

Its long-established ecosystem provides many plugins and references, which is an advantage. Although XML-based configuration can be verbose, Maven is still widely used in large-scale enterprise projects. Below is an example of a `pom.xml` file.

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
                             http://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>demo</artifactId>
    <version>0.0.1-SNAPSHOT</version>
    <packaging>jar</packaging>

    <name>demo</name>
    <description>Spring Boot with Maven Example</description>

    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.5</version>
        <relativePath/> <!-- lookup parent from repository -->
    </parent>

    <properties>
        <java.version>17</java.version>
    </properties>

    <dependencies>
        <!-- Spring Web -->
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    <build>
        <plugins>
            <!-- Spring Boot Maven Plugin -->
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>

</project>

```

Maven allows building and running with the following commands:

```bash
mvn clean package -DskipTests   # Build while skipping tests
mvn clean install               # Clean build and install to the local repository
mvn spring-boot:run             # Run directly using the Maven plugin

```

## Gradle

Gradle is a build tool based on Groovy/Kotlin DSL (Domain-Specific Language). By using DSL syntax, it is much more concise than Maven, which relies on XML, and it offers greater performance optimization and flexibility. In recent years, Gradle has become the default choice for Spring Boot projects, with advantages such as faster build speeds through caching and incremental builds.

```
plugins {
    id 'org.springframework.boot' version '3.2.5'
    id 'io.spring.dependency-management' version '1.1.4'
    id 'java'
}

group = 'com.example'
version = '0.0.1-SNAPSHOT'
sourceCompatibility = '17'   // java Version

repositories {
    mavenCentral()
}

dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-web'   // Spring Web
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa' // JPA
    runtimeOnly 'com.h2database:h2'  // H2 DB
    testImplementation 'org.springframework.boot:spring-boot-starter-test'
}

tasks.named('test') {
    useJUnitPlatform()   // JUnit5 based test execution
}

```

The build and installation steps for Gradle are as follows.

```bash
./gradlew build
./gradlew bootRun
```

## Spring Build Tool Options (feat. Gradle)

Spring build tools provide various configuration options. Gradle, in particular, offers several dependency-related options, with the most common being as follows:

### Types of ClassPath

**compileClasspath**

- Includes all class files and libraries needed to **compile project source code**
- Used only for reference during code writing/compilation; may not be included at runtime

**runtimeClasspath**

- Includes all class files and libraries needed to **run the project**
- These are the libraries the JVM must actually load during execution

In general, most dependencies included in `runtimeClasspath` are also present in `compileClasspath`.

**testCompileClasspath**

- Dependencies required for compiling test code

**testRuntimeClasspath**

- Dependencies required for running tests

---

### Dependency Options

**implementation**

- Libraries required for both compilation and runtime
- Used at build time for compilation and also included in the build output
- Not exposed to other modules that depend on this module (internal)

```bash
dependencies {
    implementation 'com.google.guava:guava:33.2.1-jre'
}

```

**api**

- Dependencies that are part of the public API
- Exposed to other modules depending on this module (public)
- If the dependency library changes, modules depending on this module must also be rebuilt

```bash
// :core module
dependencies {
    api 'org.apache.commons:commons-lang3:3.14.0'
}

// :app module (depends on core)
dependencies {
    implementation project(':core')
    // StringUtils and others are usable in :app without separate declaration (transitive)
}

```

**runtimeOnly**

- Libraries needed only at runtime (not added to the classpath at build time)
- No need for them during compilation
- Example: JDBC drivers

```bash
dependencies {
    implementation 'org.springframework.boot:spring-boot-starter-data-jpa'
    // PostgreSQL driver is only needed on the classpath at runtime
    runtimeOnly 'org.postgresql:postgresql:42.7.3'
}

```

**compileOnly**

- Required only at compile time, not needed at runtime
- Used for compilation but excluded from the build output

```bash
dependencies {
    // Provided by the container in a servlet app
    compileOnly 'jakarta.servlet:jakarta.servlet-api:6.0.0'
}

```

### Build Process

The command to build and run a Spring application is as follows:

```bash
./mvnw spring-boot:run
```

Below is the output of executing the command.

```
  .   ____          _            __ _ _
 /\\ / ___'_ __ _ _(_)_ __  __ _ \ \ \ \
( ( )\___ | '_ | '_| | '_ \/ _` | \ \ \ \
 \\/  ___)| |_)| | | | | || (_| |  ) ) ) )
  '  |____| .__|_| |_|_| |_\__, | / / / /
 =========|_|==============|___/=/_/_/_/

 :: Spring Boot ::                (v3.5.4)

2025-08-20T09:48:00.883+09:00  INFO 48585 --- [demo] [           main] com.example.demo.DemoApplication         : Starting DemoApplication using Java 17.0.15 with PID 48585 (/Users/dowonjun/Desktop/VSC/study/research/spring_demo/target/classes started by dowonjun in /Users/dowonjun/Desktop/VSC/study/research/spring_demo)
2025-08-20T09:48:00.884+09:00  INFO 48585 --- [demo] [           main] com.example.demo.DemoApplication         : No active profile set, falling back to 1 default profile: "default"
2025-08-20T09:48:01.109+09:00  INFO 48585 --- [demo] [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat initialized with port 9898 (http)
2025-08-20T09:48:01.116+09:00  INFO 48585 --- [demo] [           main] o.apache.catalina.core.StandardService   : Starting service [Tomcat]
2025-08-20T09:48:01.117+09:00  INFO 48585 --- [demo] [           main] o.apache.catalina.core.StandardEngine    : Starting Servlet engine: [Apache Tomcat/10.1.43]
2025-08-20T09:48:01.134+09:00  INFO 48585 --- [demo] [           main] o.a.c.c.C.[Tomcat].[localhost].[/]       : Initializing Spring embedded WebApplicationContext
2025-08-20T09:48:01.134+09:00  INFO 48585 --- [demo] [           main] w.s.c.ServletWebServerApplicationContext : Root WebApplicationContext: initialization completed in 230 ms
2025-08-20T09:48:01.223+09:00  INFO 48585 --- [demo] [           main] o.s.b.w.embedded.tomcat.TomcatWebServer  : Tomcat started on port 9898 (http) with context path '/'
2025-08-20T09:48:01.227+09:00  INFO 48585 --- [demo] [           main] com.example.demo.DemoApplication         : Started DemoApplication in 0.46 seconds (process running for 0.55)
2025-08-20T09:48:04.207+09:00  INFO 48585 --- [demo] [nio-9898-exec-1] o.a.c.c.C.[Tomcat].[localhost].[/]       : Initializing Spring DispatcherServlet 'dispatcherServlet'
2025-08-20T09:48:04.207+09:00  INFO 48585 --- [demo] [nio-9898-exec-1] o.s.web.servlet.DispatcherServlet        : Initializing Servlet 'dispatcherServlet'
2025-08-20T09:48:04.208+09:00  INFO 48585 --- [demo] [nio-9898-exec-1] o.s.web.servlet.DispatcherServlet        : Completed initialization in 1 ms
```

- `./mvnw`
  - Automatically downloads and runs the Maven version specified in the project → prevents version differences between team members
- Executes the `run` goal of the `spring-boot-maven-plugin`
  - Other goals include `repackage`, `stop`, etc. (each with different logic), while `run` is responsible for compiling and running the source code

**Build Process**

1. **Source code compilation & resource copying**
   - Executes the `compile` phase → generates `target/classes`
2. **Classpath assembly**
   - Combines `target/classes` with dependencies (jars fetched by Maven) → builds the runtime `classpath`
3. **Main class discovery**
   - Identifies the class annotated with `@SpringBootApplication` (e.g., `DemoApplication`) as the entry point
   - Alternatively, `start-class` can be specified in `pom.xml`
4. **JVM process execution**
   - A boot launcher such as `org.springframework.boot.devtools.restart.RestartLauncher` runs the `main()` method
   - **DevTools:** supports automatic restart when code changes are detected
5. **SpringApplication.run() invocation**
   - Initializes the IoC container, scans Beans, injects dependencies (DI), and starts the embedded Tomcat/Jetty/Undertow server

---

## Spring Optimization

Spring leverages tools such as Gradle and Maven to improve build optimization. For example, starting with Spring Boot 3, GraalVM Native Image is supported. Unlike traditional Spring applications packaged as JAR/WAR and running on the JVM, the Native Image approach uses GraalVM’s AOT (Ahead Of Time) compiler to precompile machine code binaries. This produces standalone executables that can run without the JVM. As a result, Spring applications can be deployed as lightweight containers that start within tens of milliseconds (around 50× faster than the JVM).

### GraalVM vs JVM

**Build time**

- JVM: build in a few seconds
- GraalVM Native Image: requires several minutes since all code is precompiled to machine code

**Metadata**

- JVM: naturally handles reflection, proxies, and dynamic class loading at runtime
- GraalVM Native Image: statically compiled; dynamic features require explicit `metadata`
- Spring can auto-infer much of this, but external libraries may need manual metadata configuration

**Classpath and Bean conditions fixed**

- In a GraalVM native build, the classpath and Bean conditions are fixed at build time
- Runtime changes such as DB URL or passwords are allowed, but switching DB types or altering the structure of Spring Beans is not possible

---

# Understanding Spring Components

This chapter covers functions and components used in Spring, along with debugging methods to analyze their code-level behavior. To understand Spring’s behavior at the code level, the build process and debugging approaches were studied and are described here.

## How to Debug Spring Applications

Debugging will be demonstrated using Visual Studio Code.

1. **Install VS Code extensions**
   - Extension Pack for Java
   - Spring Boot Extension Pack
2. **Navigate to the start-class file of the application** and press `Command + Shift + D`
   - Click `create a launch.json`

Write the configuration as follows:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "java",
      "name": "Debug (Attach) - Spring Boot",
      "request": "attach",
      "hostName": "localhost",
      "port": 5005
    },
    {
      "type": "java",
      "name": "Debug (Launch) - Spring Boot",
      "request": "launch",
      "mainClass": "com.example.demo.DemoApplication",
      "projectName": "demo"
    }
  ]
}
```

3. set breakpoint

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%206.png)

**4. Run and Debug selection in VS Code**

- **Attach mode**: Attaches directly to an application already running via Maven
  - A specific port is set for this reason
- **Launch mode**: Runs and debugs the Spring app directly from VS Code

**5. Inspecting call stack and threads after connecting to the app**

**Threads**

- Threads currently running inside the JVM
- `Reference Handler`, `Finalizer`, `Signal Dispatcher`: internal Java runtime management threads
- `Catalina-utility`, `http-nio-9898-exec-N`: worker threads in Tomcat that process requests
- `container-0`: main service thread for Spring/Tomcat

**Call Stack**

- Traces the methods invoked up to the current breakpoint
- Example sequence:
  `ApplicationFilterChain.doFilter` → `ApplicationFilterChain.internalDoFilter` → `HttpServlet.service` → … → `NativeMethodAccessorImpl.invoke0` → `HelloController.home()`

Using this approach, debugging Spring applications becomes straightforward. Additionally, it is also possible to build a debugging environment in the CLI using **JDB (Java Debugger)**. Rewrite’s researchers used these methods to debug Spring apps and analyze the behavior of various components.

---

## Spring Annotations

Spring annotations are metadata markers designed to simplify repetitive configurations and code in the application development process. They can be applied to classes, methods, and fields to declaratively specify behaviors or settings. Common examples include `@Component`, `@Service`, `@Repository`, and `@Transactional`. These annotations replace XML-based configuration, improve code readability and maintainability, and allow developers to focus on business logic. Below are the main categories:

### Stereotypes (Bean Registration)

- `@Component` → Registers a generic Bean
- `@Service` → Registers a service-layer Bean
- `@Repository` → Registers a DAO/Repository Bean (includes exception translation)
- `@Controller` → Registers an MVC controller
- `@RestController` → REST API controller (`@Controller + @ResponseBody`)
- `@Configuration` → Registers configuration Beans

---

### Dependency Injection (DI)

- `@Autowired` → Type-based automatic injection
- `@Qualifier` → Injects a specific Bean by name
- `@Resource` → JSR-250 injection (name-based priority)
- `@Value` → Injects property values

---

### Spring Boot Specific

- `@SpringBootApplication` → Combination of `@Configuration + @EnableAutoConfiguration + @ComponentScan`
- `@EnableAutoConfiguration` → Enables Boot’s auto-configuration
- `@ComponentScan` → Scans sub-packages for Beans automatically

---

### Web Layer (Spring MVC)

- `@RequestMapping` → Maps URLs to methods
- `@GetMapping`, `@PostMapping`, `@PutMapping`, `@DeleteMapping` → Shorthand for HTTP methods
- `@PathVariable` → Binds URL path variables
- `@RequestParam` → Binds query parameters
- `@RequestBody` → Maps request bodies (JSON/XML, etc.) to objects
- `@ResponseBody` → Serializes return values into the HTTP Response Body
- `@CrossOrigin` → Configures CORS

---

### Data Access / Transactions

- `@Transactional` → Declarative transaction management
- `@Entity` → JPA entity
- `@Table` → Maps entities to database tables
- `@Id`, `@GeneratedValue` → Marks primary keys
- `@Column` → Maps entity fields to DB columns
- `@RepositoryRestResource` → Exposes Spring Data REST repositories

---

### Validation / Binding (Bean Validation, JSR-303/380)

- `@Valid`, `@Validated` → Enable validation
- `@NotNull`, `@NotEmpty`, `@NotBlank` → Mandatory field validation
- `@Size`, `@Min`, `@Max` → Size and range validation
- `@Pattern` → Regex pattern validation
- `@Email` → Email format validation

---

### Others

- `@Bean` → Defines a Bean inside a `@Configuration` class
- `@ConditionalOnProperty`, `@ConditionalOnClass` → Conditional Bean registration (commonly used in Boot)
- `@EnableScheduling` / `@Scheduled` → Enables scheduling tasks
- `@EnableAsync` / `@Async` → Enables asynchronous execution
- `@Profile` → Activates Beans only in specific profiles

### Annotation Analysis

**@Component**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Indexed
public @interface Component {
    String value() default ""; // Can specify Bean name, e.g., @Component("mybean")
}

```

- Registers a class itself as a Bean
- Commonly applied to general Service/DAO classes

---

**@Bean**

```java
@Target({ElementType.METHOD, ElementType.ANNOTATION_TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
public @interface Bean {
    @AliasFor("name")
    String[] value() default {};

    @AliasFor("value")
    String[] name() default {};

    boolean autowireCandidate() default true;
    boolean defaultCandidate() default true;

    Bean.Bootstrap bootstrap() default Bean.Bootstrap.DEFAULT;
    String initMethod() default "";
    String destroyMethod() default "(inferred)";

    public static enum Bootstrap {
        DEFAULT,
        BACKGROUND;
        private Bootstrap() {}
    }
}

```

- Registers the return value of a method as a Bean
- Mainly used for library objects, external dependencies, or Beans that must be manually instantiated
- Declared inside a `@Configuration` class

---

**@Controller**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component
public @interface Controller {
    @AliasFor(
        annotation = Component.class
    )
    String value() default "";
}

```

- Marks a class as a controller
- Internally inherits from `@Component`, so it is automatically registered as a Bean

---

**@RestController**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Controller
@ResponseBody
public @interface RestController {
    @AliasFor(
        annotation = Controller.class
    )
    String value() default "";
}

```

- Combination of `@Controller` and `@ResponseBody`
- Method return values are directly serialized into the HTTP Response Body

---

**@Configuration**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Component
public @interface Configuration {
    @AliasFor(
        annotation = Component.class
    )
    String value() default "";

    boolean proxyBeanMethods() default true;
    boolean enforceUniqueMethods() default true;
}

```

- Marks a class as a Spring configuration class
- Internally includes `@Component`, so it is automatically registered as a Bean

---

**@SpringBootApplication**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@SpringBootConfiguration
@EnableAutoConfiguration
@ComponentScan(...)
public @interface SpringBootApplication {
    @AliasFor(
        annotation = EnableAutoConfiguration.class
    )
    Class<?>[] exclude() default {};

    @AliasFor(
        annotation = EnableAutoConfiguration.class
    )
    String[] excludeName() default {};

    @AliasFor(
        annotation = ComponentScan.class,
        attribute = "basePackages"
    )
    String[] scanBasePackages() default {};
    ...
}

```

- Entry point annotation for Spring Boot applications
- A meta-annotation that combines multiple core annotations
- Enables auto-configuration, component scanning, and configuration registration when present

---

**@SpringBootConfiguration**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Configuration
@Indexed
public @interface SpringBootConfiguration {
    @AliasFor(
        annotation = Configuration.class
    )
    boolean proxyBeanMethods() default true;
}

```

- Specialized version of `@Configuration`
- Marks the class as a configuration class

---

**@EnableAutoConfiguration**

```java
@Target({ElementType.TYPE})
@Retention(RetentionPolicy.RUNTIME)
@Documented
@Inherited
@AutoConfigurationPackage
@Import({AutoConfigurationImportSelector.class})
public @interface EnableAutoConfiguration {
    String ENABLED_OVERRIDE_PROPERTY = "spring.boot.enableautoconfiguration";
    Class<?>[] exclude() default {};
    String[] excludeName() default {};
}

```

- Core of Spring Boot
- Automatically registers Beans based on libraries present in the classpath (if predefined conditions are met)

---

**@ComponentScan**

```java
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.TYPE})
@Documented
@Repeatable(ComponentScans.class)
public @interface ComponentScan {
    @AliasFor("basePackages")
    String[] value() default {};
    ...
}

```

- Scans the current package and subpackages for `@Component`, `@Service`, `@Controller`, `@Repository`, etc., and registers them as Beans

## Spring Data Transfer Methods

Typically, a `Repository` method returns the entire entity, but in many cases, not all attributes are needed in the API.

When only specific attributes are required, it is better to extract those attributes from the entity and return them using a DTO or an interface. In such cases, the appropriate approach is the `Projection` method.

Types of `Projection` include the following:

- Interface-based Projections
- Nested Projections
- Closed / Open Projections
- Use of Default Methods
- Nullable Wrappers
- DTO

Except for DTOs, the rest are interface-based `Projections`. For example:

```java
interface PersonSummary {
    String getFirstname();
    String getLastname();
    AddressSummary getAddress();

    interface AddressSummary {
        String getCity();
    }
}

```

Interface-based projections create runtime proxy objects that map an entity into a `Projection`.

Apart from interface-based projections, DTOs can also be used to create class-based `Projections`.

**DTO**

- Stands for Data Transfer Object, an object used to transfer data
- Not a proxy object; mapped directly through a constructor
- Contains getter/setter methods
- Commonly used between the frontend view and the backend controller

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%207.png)

When using `record`, `private final` fields along with methods like `equals` and `toString` are automatically generated, making DTO creation very simple.

```java
record NamesOnly(String firstname, String lastname) {
}
```

In a regular class, the constructor to be used for mapping can be specified with the `@PersistenceCreator` annotation.

```java
public class NamesOnly {
  private final String firstname;
  private final String lastname;

  @PersistenceCreator
  public NamesOnly(String firstname, String lastname) {
    this.firstname = firstname;
    this.lastname = lastname;
  }
}
```

- The main purpose of a DTO is to handle multiple parameters in a single call, thereby reducing server round-trips.
- Instead of directly passing an Entity to the client side (such as a Controller), data is exchanged using a DTO.

---

**DAO**

- Stands for _Data Access Object_, an object responsible for accessing the database
- A design pattern that separates data access logic from the rest of the application (service or business logic)
- In Spring, it is usually marked with `@Repository`

```java
public interface ItemRepository extends JpaRepository<Item, Long> {
}

```

---

**VO**

- Stands for _Value Object_. Unlike DTOs, which have both getters and setters, VOs only provide getters, making them readable but immutable.
- Can include behaviors (methods) that enforce domain rules

```java
public final class Email {
    private final String value;

    public Email(String value) {
        if (value == null || !value.matches("^[\\w.+-]+@[\\w.-]+\\.[A-Za-z]{2,}$"))
            throw new IllegalArgumentException("Invalid email");
        this.value = value;
    }

    public String value() { return value; }

    @Override public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Email)) return false;
        return value.equals(((Email) o).value);
    }
    @Override public int hashCode() { return value.hashCode(); }
    @Override public String toString() { return value; }
}

```

Because it is declared `final`, it cannot be inherited, and since it has no `setter`, it is immutable. Equality for VOs is determined by the equality of their property values. In other words, two objects are considered the same if they share the same values.

---

# Research for Spring CVE

## CVE-2025-22223

https://spring.io/security/cve-2025-22223

This is a vulnerability caused by the incorrect use of Security Annotations in Spring Security, which can be exploited for bypass.

In an environment where `@EnableMethodSecurity` is enabled, if security annotations (such as `@PreAuthorize`, `@Secured`) are applied only to generic-based declarations (superclasses, interfaces) or override methods, but not to the actual target method, authentication bypass can occur.

In other words, the vulnerability arises under the following conditions:

1. `@EnableMethodSecurity` is used
2. Security annotations are applied only to the overridden method, while the actual target method has no annotations

As a result, the target method can be called without proper authorization.

**Affected Versions**

- Spring Security 6.4.0 ~ 6.4.3
- CVSS: 5.3

---

### Part0. Environment Setup

**Directory Structure**

```java
├── main
│   ├── java
│   │   └── com
│   │       └── example
│   │           └── demo
│   │               ├── DemoApplication.java
│   │               ├── SecurityConfig.java
│   │               ├── api
│   │               │   ├── AbstractSecureApi.java
│   │               │   └── ParamApi.java
│   │               ├── model
│   │               │   └── AccountSecret.java
│   │               ├── service
│   │               │   ├── AbstractImpl.java
│   │               │   └── ParamImpl.java
│   │               └── web
│   │                   └── PocController.java
│   └── resources
│       └── application.properties
```

`pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">

    <modelVersion>4.0.0</modelVersion>

    <groupId>com.example</groupId>
    <artifactId>spring-security-demo</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <properties>
        <java.version>17</java.version>
        <spring.security.version>6.4.0</spring.security.version>
    </properties>

    <dependencies>
        <!-- Spring Security Core -->
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-core</artifactId>
            <version>${spring.security.version}</version>
        </dependency>

        <!-- Spring Security Web -->
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-web</artifactId>
            <version>${spring.security.version}</version>
        </dependency>

        <!-- Spring Security Config -->
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-config</artifactId>
            <version>${spring.security.version}</version>
        </dependency>
    </dependencies>

    <build>
        <plugins>
            <!-- Maven Compiler Plugin -->
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>3.10.1</version>
                <configuration>
                    <source>${java.version}</source>
                    <target>${java.version}</target>
                </configuration>
            </plugin>
        </plugins>
    </build>

</project>

```

`SecurityConfig.java`

```java
@Configuration
@EnableMethodSecurity(prePostEnabled = true, securedEnabled = true, proxyTargetClass = true)
public class SecurityConfig {

    @Bean
    SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(a -> a.anyRequest().authenticated())
                .formLogin(f -> f.defaultSuccessUrl("/", true));
        return http.build();
    }

    @Bean
    UserDetailsService uds(PasswordEncoder enc) {
        UserDetails user = User.withUsername("user").password(enc.encode("userpass")).roles("USER").build();
        UserDetails admin = User.withUsername("admin").password(enc.encode("adminpass")).roles("ADMIN").build();
        return new InMemoryUserDetailsManager(user, admin);
    }

    @Bean
    PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(); }
}

```

`api/AbstractSecureApi.java`

```java
package com.example.demo.api;

import org.springframework.security.access.prepost.PreAuthorize;

public abstract class AbstractSecureApi<T> {
    @PreAuthorize("hasRole('ADMIN')")
    public abstract T mutate(T in);
}
```

`api/ParamApi.java`

```java
package com.example.demo.api;

import org.springframework.security.access.prepost.PreAuthorize;

public interface ParamApi<T> {
    @PreAuthorize("hasRole('ADMIN')")
    <S extends T> T save(S in);
}
```

Both pieces of code use the `@PreAuthorize` annotation to check whether the caller has the ADMIN role.

- `AbstractSecureApi.java`: abstract class version
- `ParamApi.java`: interface version

Under normal circumstances, the `@PreAuthorize` annotation cannot be bypassed. However, if these classes are overridden by another class (as shown in the service code examples below), the security checks can be bypassed.

`AbstractImpl.java`

```java
package com.example.demo.service;

import com.example.demo.api.AbstractSecureApi;
import com.example.demo.model.AccountSecret;
import org.springframework.stereotype.Service;

@Service
public class AbstractImpl extends AbstractSecureApi<AccountSecret> {
    @Override
    public AccountSecret mutate(AccountSecret in) {
        return new AccountSecret(in.value() + "-B");
    }
}
```

`ParamImpl.java`

```java
package com.example.demo.service;

import com.example.demo.api.ParamApi;
import com.example.demo.model.AccountSecret;
import org.springframework.stereotype.Service;

// The actual target Bean’s implementation method does not have a security annotation.
@Service
public class ParamImpl implements ParamApi<AccountSecret> {
    @Override
    public AccountSecret save(AccountSecret in) {
        return new AccountSecret(in.value() + "-A");
    }
}
```

### Part1. Root Cause

When `@EnableMethodSecurity` is enabled, `UniqueSecurityAnnotationScanner` scans the hierarchy to find security annotations on the target method being called.

```java
final class UniqueSecurityAnnotationScanner<A extends Annotation> extends AbstractSecurityAnnotationScanner<A> {
....
.... omitted
    try {
        Method methodToUse = targetClass.getDeclaredMethod(method.getName(), method.getParameterTypes());

```

At this point, the scanner uses erasure-based signature matching such as `targetClass.getDeclaredMethod(method.getName(), method.getParameterTypes())` to find the actual overridden method of the child class. With this erasure-based matching, the implemented `mutate` in `AbstractImpl` is seen as `AccountSecret mutate(AccountSecret)`, but the overridden bridge method `mutate` in `AbstractSecureApi` is seen as `Object mutate(Object)`. As a result, it appears as if there is no annotation, and the annotation on the parent declaration is missed.

### Part2. PoC

Because of this vulnerability, in the controller below, a user with only user privileges can also access `/pocA` and `/pocB`.

```java
@RestController
public class PocController {
    private final ParamImpl paramImpl;
    private final AbstractImpl abstractImpl;

    public PocController(ParamImpl paramImpl, AbstractImpl abstractImpl) {
        this.paramImpl = paramImpl;
        this.abstractImpl = abstractImpl;
    }

    @GetMapping("/")
    public String home() { return "home"; }

    @GetMapping("/pocA")
    public String pocA() {
        return paramImpl.save(new AccountSecret("TOP")).value();
    }

    @GetMapping("/pocB")
    public String pocB() {
        return abstractImpl.mutate(new AccountSecret("TOP")).value();
    }
}

```

1. Log in with userID

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%208.png)

2. Accessing `/pocA`, `/pocB` (Spring Security version 6.4.0) – vulnerability check

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%209.png)

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2010.png)

3. Accessing `/pocA`, `/pocB` (Spring Security version 6.4.4) – Patch Verification

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2011.png)

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2012.png)

### Part3. Remediating and Defending

https://github.com/spring-projects/spring-security/commit/dc2e1af2dab8ef81cd4edd25b56a2babeaab8cf9

Since version 6.4.4, instead of using the previous erasure-based signature, `findMethod` was introduced so that security annotations on overridden methods can also be followed.

```java
-		try {
-			Method methodToUse = targetClass.getDeclaredMethod(method.getName(), method.getParameterTypes());
+		Method methodToUse = findMethod(method, targetClass);
+		if (methodToUse != null) {

```

To obtain the most specific actual call target, bridge/covariant/proxy methods are resolved, and then annotations are merged and searched in the following order of priority:

1. The concrete method that will actually be invoked
2. If necessary, the declaring class/interface level
   1. If the method is a bridge, the original bridge method
   2. The corresponding method in a parameterized superclass/interface

With this approach, security annotations applied to generic substituted parent declarations are also treated as belonging to the target method, making bypass impossible.

## CVE-2025-41232

`CVE-2025-41232` is a vulnerability in certain versions of spring-security-core where the logic that detects methods with Spring security annotations was incorrectly implemented, allowing security elements to be bypassed. Notably, this vulnerability originated from code created to patch `CVE-2025-22223`, and since the configuration conditions required to exploit it were not complex, many Spring applications were affected. Below is the analysis of this vulnerability.

Affected

- spring security 6.4.0 - 6.4.5
  - Use of `@EnableMethodSecurity(mode=ASPECTJ)`
  - Use of spring-security-aspects
  - Use of security annotations on private/protected methods, e.g., `@PreAuthorize`

### Part0. Environment Setup

**Directory Structure**

```bash
.
├── aspectj-poc.zip
├── build.gradle
├── gradle
│   └── wrapper
│       ├── gradle-wrapper.jar
│       └── gradle-wrapper.properties
├── gradlew
├── gradlew.bat
├── pom.xml
├── settings.gradle
├── src
│   ├── main
│   │   ├── java
│   │   │   └── com
│   │   │       └── example
│   │   │           └── demo
│   │   │               ├── AspectjPocApplication.java
│   │   │               ├── LeakController.java
│   │   │               ├── SecretService.java
│   │   │               └── SecurityConfig.java
│   │   └── resources
│   │       ├── application.properties
│   │       ├── static
│   │       └── templates
│   └── test
│       └── java
│           └── com
│               └── example
│                   └── demo
│                       └── AspectjPocApplicationTests.java
│
```

`pom.xml`

```xml
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.5</version>
    <relativePath/>
  </parent>

  <groupId>poc.cve41232</groupId>
  <artifactId>aspectj-poc</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <name>aspectj-poc</name>
  <description>PoC for CVE-2025-41232 (AspectJ + spring-security-aspects)</description>

  <properties>
    <java.version>17</java.version>
    <spring-security.version>6.4.5</spring-security.version>
  </properties>

  <dependencyManagement>
    <dependencies>
      <dependency>
        <groupId>org.springframework.security</groupId>
        <artifactId>spring-security-bom</artifactId>
        <version>${spring-security.version}</version>
        <type>pom</type>
        <scope>import</scope>
      </dependency>
    </dependencies>
  </dependencyManagement>

  <dependencies>
    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-web</artifactId>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-security</artifactId>
    </dependency>

    <dependency>
      <groupId>org.springframework.security</groupId>
      <artifactId>spring-security-aspects</artifactId>
    </dependency>

    <dependency>
      <groupId>org.aspectj</groupId>
      <artifactId>aspectjweaver</artifactId>
      <version>1.9.22.1</version>
      <scope>runtime</scope>
    </dependency>

    <dependency>
      <groupId>org.springframework.boot</groupId>
      <artifactId>spring-boot-starter-test</artifactId>
      <scope>test</scope>
    </dependency>
  </dependencies>

  <build>
    <plugins>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
      </plugin>
    </plugins>
  </build>
</project>
```

`AspectjPocApplication.java`

```java
package com.example.demo;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class AspectjPocApplication {

	public static void main(String[] args) {
		SpringApplication.run(AspectjPocApplication.class, args);
	}

}
```

`LeakController.java`

```java
package com.example.demo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class LeakController {
    private final SecretService svc;
    public LeakController(SecretService svc) { this.svc = svc; }

    @GetMapping("/leak")
    public String leak() {
        return svc.invokeSecret();
    }

}
```

`SecretService.java`

```java
package com.example.demo;

import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.stereotype.Service;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import java.util.List;

@Service
public class SecretService {
    @PreAuthorize("hasRole('X')")
    private String privateMethod() {
        return "FLAG{authorization-bypass}";
    }
    public String invokeSecret() {
        return privateMethod();
    }
}
```

`SecurityConfig.java`

```java
package com.example.demo;

import org.springframework.context.annotation.AdviceMode;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.EnableLoadTimeWeaving;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableMethodSecurity(prePostEnabled = true, mode = AdviceMode.ASPECTJ)
public class SecurityConfig {
    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        http.csrf(csrf -> csrf.disable());
        http.authorizeHttpRequests(reg -> reg.anyRequest().permitAll());
        return http.build();
    }
}
```

### Part1. Security Annotations and Detection Method in Spring

There are two ways in Spring to protect methods. One is the Based Proxy method, which intercepts the call flow before method execution to verify authorization, and the other is the Based AspectJ method, which directly inserts security logic through bytecode weaving using AspectJ.

**Based Proxy**

- Uses Spring AOP (proxy-based) to intercept method calls and perform authorization checks
  - Only applicable to Public Methods
  - Cannot be applied to `final`, `private`, or `static` methods
  - Generally the most commonly used

**Based AspectJ**

- Uses AspectJ to insert authorization check logic through bytecode weaving
  - When Java source is compiled, `.class` files are generated
  - As the JVM loads the `.class` file into memory, the authorization logic is inserted
  - Allows adding new behavior (logging, authorization checks, transaction management, etc.) at runtime without modifying the original source
  - Example:
    - Original

    ```java
    class SecretService {
        String getSecret() {
            return "FLAG{secret}";
        }
    }
    ```

    - After AspectJ Weaving

    ```java
    class SecretService {
        String getSecret() {
            if (!SecurityContext.hasRole("ADMIN")) {
                throw new AccessDeniedException();
            }
            return "FLAG{secret}";
        }
    }
    ```

- Can apply annotations even to methods such as `private`, `final`, and `static`
- More powerful than the proxy method, but more complex to configure and requires the `aspectjweaver` javaagent

**Weaving Types**

- **Compile Time Weaving (CTW)**
  - Inserts code when `javac` generates `.class` files
- **Post Compile Weaving (Binary Weaving)**
  - Weaves into already compiled `.class` or `.jar` files to generate new `.class` files
- **Load-time Weaving (LTW)**
  - The `javaagent` intervenes when the JVM loads classes and modifies the bytecode
  - Required for using AspectJ mode in Spring Security

`CVE-2025-41232` was discovered in the Based AspectJ method. This is because the method detection logic included in the functions called by AspectJ was incorrectly designed. To understand this, it is necessary to look at the process of scanning methods with security annotations. In general, method security annotations such as `@PreAuthorize("hasRole('X')")` are designed to be read and executed using reflection.

- **Reflection**
  - A feature that allows inspection, invocation, and even modification of program structures such as classes, methods, and fields during JVM runtime
  - → Enables examining and controlling program structures dynamically at runtime without hardcoding

However, reflection has high invocation costs and is particularly slow when scanning inheritance, interfaces, and bridge methods. In real services, controllers and services may be called tens of millions of times, and if annotations are read by reflection on every call, performance degradation is inevitable. Therefore, in Spring, reading and executing security annotations is implemented such that reflection scanning is only performed on the first call, and subsequent lookups are handled in O(1) time using a `ConcurrentHashMap` cache.

```java
// https://github.com/spring-projects/spring-security/blob/6fb0591109e3c6d9fef9ee2d1a4f215c738c22da/core/src/main/java/org/springframework/security/core/annotation/UniqueSecurityAnnotationScanner.java#L112
	MergedAnnotation<A> merge(AnnotatedElement element, Class<?> targetClass) {
		if (element instanceof Parameter parameter) {
			return this.uniqueParameterAnnotationCache.computeIfAbsent(parameter, (p) -> {
				List<MergedAnnotation<A>> annotations = findParameterAnnotations(p);
				return requireUnique(p, annotations);
			});
		}
		if (element instanceof Method method) {
			return this.uniqueMethodAnnotationCache.computeIfAbsent(new MethodClassKey(method, targetClass), (k) -> {
				List<MergedAnnotation<A>> annotations = findMethodAnnotations(method, targetClass);
				return requireUnique(method, annotations);
			});
		}
		throw new AnnotationConfigurationException("Unsupported element of type " + element.getClass());
	}
```

At this point, the function that generates cache data after the reflection scan is the `merge()` function. It scans method/parameter security annotations, stores them in the cache, and afterward retrieves and returns them from the cache (cache key: `new MethodClassKey(method, targetClass)`). In this process, the `merge()` function calls `findMethodAnnotations(Method method, Class<?> targetClass)` to scan for methods with security annotations (only scanning the annotations required during the current request handling).

```java
// https://github.com/spring-projects/spring-security/blob/6fb0591109e3c6d9fef9ee2d1a4f215c738c22da/core/src/main/java/org/springframework/security/core/annotation/UniqueSecurityAnnotationScanner.java#L196
	private List<MergedAnnotation<A>> findMethodAnnotations(Method method, Class<?> targetClass) {
		Method specificMethod = ClassUtils.getMostSpecificMethod(method, targetClass);
		List<MergedAnnotation<A>> annotations = findClosestMethodAnnotations(specificMethod,
				specificMethod.getDeclaringClass(), new HashSet<>());
		if (!annotations.isEmpty()) {
			return annotations;
		}
		if (specificMethod != method) {
			annotations = findClosestMethodAnnotations(method, method.getDeclaringClass(), new HashSet<>());
			if (!annotations.isEmpty()) {
				return annotations;
			}
		}
		annotations = findClosestClassAnnotations(specificMethod.getDeclaringClass(), new HashSet<>());
		if (!annotations.isEmpty()) {
			return annotations;
		}
		return Collections.emptyList();
	}
```

The reason for searching methods here is that the annotated method may be declared in an interface or a superclass (since the same method could be overridden). `ClassUtils.getMostSpecificMethod(...)` is called to retrieve the actual method that will be executed at runtime, based on the class (`targetClass`) where the annotation was detected. From this method, `findClosestMethodAnnotations()` is then invoked.

- Since the method actually called at runtime belongs to the `targetClass` implementation, the overridden method is retrieved
- Based on the retrieved method, `findClosestMethodAnnotations()` is called

```java
// https://github.com/spring-projects/spring-security/blob/6fb0591109e3c6d9fef9ee2d1a4f215c738c22da/core/src/main/java/org/springframework/security/core/annotation/UniqueSecurityAnnotationScanner.java#L222
	private List<MergedAnnotation<A>> findClosestMethodAnnotations(Method method, Class<?> targetClass,
			Set<Class<?>> classesToSkip) {
		if (targetClass == null || classesToSkip.contains(targetClass) || targetClass == Object.class) {
			return Collections.emptyList();
		}
		classesToSkip.add(targetClass);
		Method methodToUse = findMethod(method, targetClass);
		if (methodToUse != null) {
			List<MergedAnnotation<A>> annotations = findDirectAnnotations(methodToUse);
			if (!annotations.isEmpty()) {
				return annotations;
			}
		}
		List<MergedAnnotation<A>> annotations = new ArrayList<>(
				findClosestMethodAnnotations(method, targetClass.getSuperclass(), classesToSkip));
		for (Class<?> inter : targetClass.getInterfaces()) {
			annotations.addAll(findClosestMethodAnnotations(method, inter, classesToSkip));
		}
		return annotations;
	}
```

This function searches for annotations based on the specific method, because annotations may exist not only on the implementation method but also on the interface declaration or superclass. It first searches for security annotations on the `specificMethod` itself, and if none are found, it recursively traverses up to the superclass or interface to locate the “closest annotation.”

- This process is carried out through recursive calls
- As a result, annotations on interfaces and superclasses are also searched
- However, the function returns the first “closest annotation” it encounters

At this stage, the logic ensures that already visited classes are not revisited.

```java
if (targetClass == null || classesToSkip.contains(targetClass) || targetClass == Object.class) {
		return Collections.emptyList();
}
```

After this, in order to find the actual `Method` object corresponding to the `method` passed as a parameter, `findMethod(method, targetClass)` is called based on `targetClass` and `method`.

```java
// https://github.com/spring-projects/spring-security/blob/6fb0591109e3c6d9fef9ee2d1a4f215c738c22da/core/src/main/java/org/springframework/security/core/annotation/UniqueSecurityAnnotationScanner.java#L268
private static Method findMethod(Method method, Class<?> targetClass) {
    for (Method candidate : targetClass.getDeclaredMethods()) {
        if (candidate == method) {
            return candidate;
        }
        if (isOverride(method, candidate)) {
            return candidate;
        }
    }
    return null;
}

```

Looking at the code logic, the `getDeclaredMethods()` function is called to retrieve all method objects declared in the `targetClass`, which are then iterated over and assigned to `candidate`. It first checks reference equality (`==`) between `candidate` and the `method` parameter; if they are the same reference, the `candidate` object is returned. After this check, the `isOverride(method, candidate)` function is used to compare override relationships, and depending on the result, it either returns `candidate` or `null`.

If the method object is successfully returned, the reflection invocation logic is executed based on that method, and the resulting data is added to the cache.

---

### Part2. Root Cause

**Environment Setup**

To analyze the root cause, it was necessary to set breakpoints inside the spring-security-core code. Therefore, instead of using the GUI debugger in VS Code as described earlier, a Java debugging port was opened and JDB was attached for analysis.

- Application execution

```bash
java -javaagent:"$WEAVER" \
  -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address='*:5005' \
  -Dorg.aspectj.weaver.showWeaveInfo=true -Daj.weaving.verbose=true \
  -jar target/aspectj-poc-0.0.1-SNAPSHOT.jar
```

- JDB attatch

```bash
# jdb -attach 5005
Set uncaught java.lang.Throwable
Set deferred uncaught java.lang.Throwable
Initializing jdb ...
> stop in org.springframework.security.core.annotation.UniqueSecurityAnnotationScanner.findMethod(java.lang.reflect.Method, java.lang.Class)
Set breakpoint org.springframework.security.core.annotation.UniqueSecurityAnnotationScanner.findMethod(java.lang.reflect.Method, java.lang.Class)
```

**Vulnerable Code**

In fact, if Part1 was read carefully, it is clear where the vulnerability occurs. The vulnerability arises in the `findMethod(method, targetClass)` function.

```java
// https://github.com/spring-projects/spring-security/blob/6fb0591109e3c6d9fef9ee2d1a4f215c738c22da/core/src/main/java/org/springframework/security/core/annotation/UniqueSecurityAnnotationScanner.java#L268
private static Method findMethod(Method method, Class<?> targetClass) {
    for (Method candidate : targetClass.getDeclaredMethods()) {
        if (candidate == method) {
            return candidate;
        }
        if (isOverride(method, candidate)) {
            return candidate;
        }
    }
    return null;
}

```

The `findMethod()` function compares the `method` object passed as a parameter with the objects retrieved from `getDeclaredMethods()` using the `==` operator. In other words, it performs a reference equality comparison. However, even if the signatures are identical, the `Method` instances are different, which causes the reference equality check to fail.

Since `Method` is a reflection handle, different instances are created depending on how it is obtained. This means that a `method` object obtained through AspectJ weaving, proxies, or other code paths is not the same instance as the `candidate` method created by `targetClass.getDeclaredMethods()`. As a result, the verification fails.

This fact can be confirmed through JDB.

```java
http-nio-9999-exec-1[1] locals
Method arguments:
method = instance of java.lang.reflect.Method(id=7562)
targetClass = instance of java.lang.Class(reflected class=com.example.demo.SecretService, id=6238)
Local variables:
candidate = instance of java.lang.reflect.Method(id=7572)
http-nio-9999-exec-1[1] print candidate
 candidate = "private java.lang.String com.example.demo.SecretService.privateMethod()"
http-nio-9999-exec-1[1] print method
 method = "private java.lang.String com.example.demo.SecretService.privateMethod()"
http-nio-9999-exec-1[1] print method == candidate
 method == candidate = false
http-nio-9999-exec-1[1] print method.equals(candidate)
 method.equals(candidate) = true
http-nio-9999-exec-1[1]
```

Even though the methods have the same signature, it can be confirmed that the reference equality check fails.

### Part3. PoC/Exploit for CVE-2025-41232

After completing the environment setup as described in Part0, a request can be sent to the `/leak` endpoint to check the response value and verify that the application is vulnerable. It is also possible to observe the difference in responses depending on the spring-security-core version.

spring-security-core 6.4.5

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2013.png)

spring-security-core 6.4.6

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2014.png)

In spring-security-core 6.4.6 ver, 403 responsed.

### Part4. Remediating and Defending

[https://github.com/spring-projects/spring-security/issues/17143](https://github.com/spring-projects/spring-security/issues/17143?utm_source=chatgpt.com)

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2015.png)

The vulnerability was mitigated by changing the method searching approach.

```diff
...
	private static Method findMethod(Method method, Class<?> targetClass) {
		for (Method candidate : targetClass.getDeclaredMethods()) {
-			if (candidate == method) {
+			if (candidate.equals(method)) {
				return candidate;
			}
...
```

The logic was changed so that instead of performing the `==` comparison, it now uses `equals`, allowing validation even when the two objects have different references.

**`==`**

- Compares whether two variables reference the same object
- For primitive types, compares the actual value
- For object types, compares reference addresses

**`.equals()`**

- Compares whether two objects are logically equal
- Follows the `.equals()` implementation overridden in each class
  - `String.equals()` → compares string contents
  - `Integer.equals()` → compares numeric values
  - `Method.equals()` → compares method signatures

## CVE-2025-22233

https://spring.io/security/cve-2025-22233

`CVE-2025-22233` is a vulnerability in Spring Framework where an inconsistency in case handling during the comparison and blocking process of `DataBinder`’s `disallowedFields` allows binding to occur in certain situations, bypassing `disallowedFields`.

**Affected**

- Spring Framework
  - 6.2.0 – 6.2.6
  - 6.1.0 – 6.1.19
  - 6.0.0 – 6.0.27
  - 5.3.0 – 5.3.42
- Configuration using `setDisallowedFields` to block field binding
- `disallowedFields` field name starting with `i`

### Part0. Environment Setup

**Directory Structure**

```xml
├─main
│  ├─java
│  │  └─com
│  │      └─example
│  │          └─cve202522233
│  │                  Cve202522233Application.java
│  │                  User.java
│  │                  UserController.java
│  │
│  └─resources
│      │  application.properties
│      │
│      ├─static
│      └─templates
```

`pom.xml`

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.4.5</version>
		<relativePath/>
	</parent>
	<dependencyManagement>
    <dependencies>
		<dependency>
			<groupId>org.springframework</groupId>
			<artifactId>spring-framework-bom</artifactId>
			<version>6.2.6</version>
			<type>pom</type>
			<scope>import</scope>
		</dependency>
		</dependencies>
  	</dependencyManagement>
	<groupId>com.example</groupId>
	<artifactId>cve202522233</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>cve202522233</name>
	<description>Demo project for Spring Boot</description>
	<url/>
	<licenses>
		<license/>
	</licenses>
	<developers>
		<developer/>
	</developers>
	<scm>
		<connection/>
		<developerConnection/>
		<tag/>
		<url/>
	</scm>
	<properties>
		<java.version>17</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-validation</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
	</dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>

</project>

```

`User.java`

```java
package com.example.cve202522233;

public class User {
    private String id;
    private String role;
    private String description;

    public String getId() { return id; }
    public void setId(String id) { this.id = id; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

}

```

`UserController.java`

```java
package com.example.cve202522233;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.bind.WebDataBinder;

@Controller
public class UserController {

    private static final List<User> DATA = new CopyOnWriteArrayList<>();

    @InitBinder
    public void initBinder(WebDataBinder binder) {
        binder.setDisallowedFields("id","role");
    }

    @GetMapping("/add")
    @ResponseBody
    public String add(@ModelAttribute User user) {
        DATA.add(user);
        return "added: id=" + user.getid()
            + ", role=" + user.getRole()
            + ", description=" + user.getDescription();
    }

}

```

In Spring MVC, user input is received to create a `User` object and store it in `DATA`, while configuring data binding to exclude the `role` and `id` fields.

`Cve202522233Application.java`

```java
package com.example.cve202522233;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Cve202522233Application {

	public static void main(String[] args) {
		SpringApplication.run(Cve202522233Application.class, args);
	}

}

```

### Part1. Root Cause

```java
protected void doBind(MutablePropertyValues mpvs) {
    checkAllowedFields(mpvs);   // Verify if the fields are allowed for binding
    checkRequiredFields(mpvs);  // Check if all required fields are present
    applyPropertyValues(mpvs);  // Perform actual binding to the object
}

```

`mpvs` contains the values extracted from query strings and other request parameters.

When `setDisallowedFields` is configured, validation is performed inside `checkAllowedFields`.

```java
	protected void checkAllowedFields(MutablePropertyValues mpvs) {
		PropertyValue[] pvs = mpvs.getPropertyValues();
		for (PropertyValue pv : pvs) {
			String field = PropertyAccessorUtils.canonicalPropertyName(pv.getName());
			if (!isAllowed(field)) {
				mpvs.removePropertyValue(pv);
				getBindingResult().recordSuppressedField(field);
				if (logger.isDebugEnabled()) {
					logger.debug("Field [" + field + "] has been removed from PropertyValues " +
							"and will not be bound, because it has not been found in the list of allowed fields");
				}
			}
		}
	}
```

Parameter values are retrieved as an array, iterated over, normalized into field names, and then checked against the allow/deny lists so that certain fields are excluded from binding.

```java
protected boolean isAllowed(String field) {
    String[] allowed = getAllowedFields();
    String[] disallowed = getDisallowedFields();
    return ((ObjectUtils.isEmpty(allowed) || PatternMatchUtils.simpleMatch(allowed, field)) &&
            (ObjectUtils.isEmpty(disallowed) || !PatternMatchUtils.simpleMatch(disallowed, field.toLowerCase(Locale.ROOT))));
}

```

It returns `true` if the allow list is empty or the `field` matches an allowed pattern, and the deny list is empty or the lowercased field name (ignoring locale) does not match any deny pattern.

At this point, if a field name starting with `İ` (`\u0130`) is provided, when converted to lowercase it becomes `i̇` (`\u0069 \u0307`).

```java
public static boolean simpleMatch(@Nullable String[] patterns, @Nullable String str) {
    if (patterns != null) {
        // patterns are the disallowed field names
        for (String pattern : patterns) {
            if (simpleMatch(pattern, str)) {
                return true;
            }
        }
    }
    return false;
}
```

If even one of the disallowed field names matches `str`, the function returns `true`, meaning the field is excluded from binding.

```java
	public static boolean simpleMatch(@Nullable String pattern, @Nullable String str) {
		if (pattern == null || str == null) {
			return false;
		}

		int firstIndex = pattern.indexOf('*');
		if (firstIndex == -1) {
			return pattern.equals(str);
		}

		if (firstIndex == 0) {
			if (pattern.length() == 1) {
				return true;
			}
			int nextIndex = pattern.indexOf('*', 1);
			if (nextIndex == -1) {
				return str.endsWith(pattern.substring(1));
			}
			String part = pattern.substring(1, nextIndex);
			if (part.isEmpty()) {
				return simpleMatch(pattern.substring(nextIndex), str);
			}
			int partIndex = str.indexOf(part);
			while (partIndex != -1) {
				if (simpleMatch(pattern.substring(nextIndex), str.substring(partIndex + part.length()))) {
					return true;
				}
				partIndex = str.indexOf(part, partIndex + 1);
			}
			return false;
		}

		return (str.length() >= firstIndex &&
				pattern.startsWith(str.substring(0, firstIndex)) &&
				simpleMatch(pattern.substring(firstIndex), str.substring(firstIndex)));
	}
```

If `*` is not present, the check is performed directly with `pattern.equals(str)`.

![value diff](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2016.png)

value diff

Since the earlier lowercase conversion changes the input into `i̇` (`\u0069\u0307`), it can bypass disallowed field names that start with `i`.

In the case of `K`, it is converted into `k`, so it cannot be used to bypass.

After that, the values are actually bound to the target object.

```java
	protected void applyPropertyValues(MutablePropertyValues mpvs) {
		try {
			getPropertyAccessor().setPropertyValues(mpvs, isIgnoreUnknownFields(), isIgnoreInvalidFields());
		}
		catch (PropertyBatchUpdateException ex) {
			for (PropertyAccessException pae : ex.getPropertyAccessExceptions()) {
				getBindingErrorProcessor().processPropertyAccessException(pae, getInternalBindingResult());
			}
		}
	}
```

```java
	public void setPropertyValues(PropertyValues pvs, boolean ignoreUnknown, boolean ignoreInvalid)
			throws BeansException {

		List<PropertyAccessException> propertyAccessExceptions = null;
		List<PropertyValue> propertyValues = (pvs instanceof MutablePropertyValues mpvs ?
				mpvs.getPropertyValueList() : Arrays.asList(pvs.getPropertyValues()));

		if (ignoreUnknown) {
			this.suppressNotWritablePropertyException = true;
		}
		try {
			for (PropertyValue pv : propertyValues) {

				try {
					setPropertyValue(pv);
				}
				catch (NotWritablePropertyException ex) {
					if (!ignoreUnknown) {
						throw ex;
					}
				}
				catch (NullValueInNestedPathException ex) {
					if (!ignoreInvalid) {
						throw ex;
					}
				}
				catch (PropertyAccessException ex) {
					if (propertyAccessExceptions == null) {
						propertyAccessExceptions = new ArrayList<>();
					}
					propertyAccessExceptions.add(ex);
				}
			}
		}
		finally {
			if (ignoreUnknown) {
				this.suppressNotWritablePropertyException = false;
			}
		}

		if (propertyAccessExceptions != null) {
			PropertyAccessException[] paeArray = propertyAccessExceptions.toArray(new PropertyAccessException[0]);
			throw new PropertyBatchUpdateException(paeArray);
		}
	}
```

Among the values in `mpvs`, if the target object (for example, fields in the `User` class) has a matching name, the value is set; if not, it is skipped.

```java
	public void setPropertyValue(PropertyValue pv) throws BeansException {
		PropertyTokenHolder tokens = (PropertyTokenHolder) pv.resolvedTokens;
		if (tokens == null) {
			String propertyName = pv.getName();
			AbstractNestablePropertyAccessor nestedPa;
			try {
				nestedPa = getPropertyAccessorForPropertyPath(propertyName); // nested paths
			}
			catch (NotReadablePropertyException ex) {
				throw new NotWritablePropertyException(getRootClass(), this.nestedPath + propertyName,
						"Nested property in path '" + propertyName + "' does not exist", ex);
			}
			tokens = getPropertyNameTokens(getFinalPath(nestedPa, propertyName));
			if (nestedPa == this) {
				pv.getOriginalPropertyValue().resolvedTokens = tokens;
			}
			nestedPa.setPropertyValue(tokens, pv);
		}
		else {
			setPropertyValue(tokens, pv);
		}
	}
```

It locates nested paths, tokenizes them, and then applies the values accordingly.

```java
//nestedPa.setPropertyValue
	protected void setPropertyValue(PropertyTokenHolder tokens, PropertyValue pv) throws BeansException {
		if (tokens.keys != null) {
			processKeyedProperty(tokens, pv);
		}
		else {
			processLocalProperty(tokens, pv);
		}
	}
```

If `token.keys` is not present, it is treated as a regular Bean field and looked up based on the field name.

```java
	private void processLocalProperty(PropertyTokenHolder tokens, PropertyValue pv) {
		PropertyHandler ph = getLocalPropertyHandler(tokens.actualName);
		if (ph == null || !ph.isWritable()) {
			if (pv.isOptional()) {
				if (logger.isDebugEnabled()) {
					logger.debug("Ignoring optional value for property '" + tokens.actualName +
							"' - property not found on bean class [" + getRootClass().getName() + "]");
				}
				return;
			}
			if (this.suppressNotWritablePropertyException) {
				return;
			}
			throw createNotWritablePropertyException(tokens.canonicalName);
		}
		...
```

```java
	protected BeanPropertyHandler getLocalPropertyHandler(String propertyName) {
		PropertyDescriptor pd = getCachedIntrospectionResults().getPropertyDescriptor(propertyName);
		return (pd != null ? new BeanPropertyHandler((GenericTypeAwarePropertyDescriptor) pd) : null);
	}
```

If matching fails, it retries by applying `uncapitalize` or `capitalize` to the first character.

```java
@Nullable
PropertyDescriptor getPropertyDescriptor(String name) {
    PropertyDescriptor pd = this.propertyDescriptors.get(name);
    if (pd == null && StringUtils.hasLength(name)) {
        // Same lenient fallback checking as in Property...
        pd = this.propertyDescriptors.get(StringUtils.uncapitalize(name));
        if (pd == null) {
            pd = this.propertyDescriptors.get(StringUtils.capitalize(name));
        }
    }
    return pd;
}

```

Through `StringUtils.uncapitalize`, the first character is normalized, and `İ` is converted into `i`.

```java
public static String uncapitalize(String str) {
    return changeFirstCharacterCase(str, false);
}

```

```java
	private static String changeFirstCharacterCase(String str, boolean capitalize) {
		if (!hasLength(str)) {
			return str;
		}

		char baseChar = str.charAt(0);
		char updatedChar;
		if (capitalize) {
			updatedChar = Character.toUpperCase(baseChar);
		}
		else {
			updatedChar = Character.toLowerCase(baseChar);
		}
		if (baseChar == updatedChar) {
			return str;
		}

		char[] chars = str.toCharArray();
		chars[0] = updatedChar;
		return new String(chars);
	}

```

In this code, when the first character is converted to lowercase and handled as a `char` type, the `\u0307` is truncated.

Because of this, the vulnerability occurs only when the disallowed field starts with `i`.

### Part2. PoC

In an environment where a disallowed field starting with `i` is registered, if the first character of the request parameter key is changed to `İ` (`\u0130`) and sent, the vulnerability can be confirmed.

**6.2.6 Normal Behavior**

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2017.png)

**6.2.6 Abnormal Behavior**

![image.png](/[KR]%20How%20does%20Spring%20work%20-%20Deep%20Research%20of%20Sprin%2026995ea211f580a689d9f43c53cc9cb4/image%2018.png)

### Part3. Remediating and Defending

https://github.com/spring-projects/spring-framework/compare/v6.2.6...v6.2.7#diff-c87bc1f9f200911cf1e7162e93f842fe6c2451b27f60ec5f00a22611d50199cb

https://github.com/spring-projects/spring-framework/compare/v6.2.6...v6.2.7#diff-1f22c41307a3ddcec8f1bc7a237d3b77ac7564883f4c663402993affac8a5756

```diff
		else {
			String[] fieldPatterns = new String[disallowedFields.length];
			for (int i = 0; i < fieldPatterns.length; i++) {
-				String field = PropertyAccessorUtils.canonicalPropertyName(disallowedFields[i]);
-				fieldPatterns[i] = field.toLowerCase(Locale.ROOT);
+       fieldPatterns[i] = PropertyAccessorUtils.canonicalPropertyName(disallowedFields[i]);
			}
			this.disallowedFields = fieldPatterns;
		}
```

```diff
	protected boolean isAllowed(String field) {
		String[] allowed = getAllowedFields();
		String[] disallowed = getDisallowedFields();
-		return ((ObjectUtils.isEmpty(allowed) || PatternMatchUtils.simpleMatch(allowed, field)) &&
-				(ObjectUtils.isEmpty(disallowed) || !PatternMatchUtils.simpleMatch(disallowed, field.toLowerCase(Locale.ROOT))));
+		if (!ObjectUtils.isEmpty(allowed) && !PatternMatchUtils.simpleMatch(allowed, field)) {
+			return false;
+		}
+		if (!ObjectUtils.isEmpty(disallowed)) {
+			return !PatternMatchUtils.simpleMatchIgnoreCase(disallowed, field);
+		}
+		return true;
	}
```

The pre-normalization previously applied to disallowed fields and request parameters was removed, and the `disallowedFields` check itself was modified to be case-insensitive.

# Conclusion

Through this Spring research, I was able to understand and study the code-level behavior of security annotations, model permission checks, and other Spring security elements that I had previously only understood conceptually. Although this covers only a portion, I also gained insights into the components and characteristics that make up Spring, as well as its layered structure.

In the course of the research, I realized how important it is not just to understand whether a security feature in a framework “exists or not,” but to grasp its internal mechanisms and limitations. For example, by checking at the code level how annotation-based access control scans and merges on a per-method basis, and how proxies and AOP control call flows, I gained a concrete understanding of what it really means when we say that “security logic is injected at the framework level.”

As a result, this research helped me move beyond a surface-level understanding of Spring’s security features. It highlighted the importance of asking and answering the fundamental questions: _Why is this security element necessary, how does it work, and under what conditions can it be neutralized?_ Going forward, I recognize the strong need to continue deeper studies of framework security features that focus not only on their usage but also on their internal structures and real attack scenarios.
