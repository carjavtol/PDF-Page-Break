# Banner Grabbing

In this task you will learn how to perform banner grabbing with a plethora of tools in order to obtain service version information from specific services running on a target system.

## Goal

Identify the services and versions running on a target machine using banner grabbing techniques with Netcat, Nmap, and other tools.

## Pre-requisites

1. Basic familiarity with Linux terminal commands and Nmap.
2. Access to a Kali Linux instance.

## Requirements

This task does not have any requirements.

---

**Step 1:** Open the lab link to access the Kali GUI instance

**Step 2:** Identify the target IP address

Before we can begin exploring banner grabbing, you will need to obtain the IP address of the target system within the lab environment. This is because the IP addresses and the corresponding subnets change whenever you launch a lab.

To identify the target IP address, run the following command on the Kali Linux system:

```bash
sudo arp-scan -I eth1 -g 10.0.0.0/24
```

You should see output similar to this:

```
Interface: eth1, type: EN10MB, MAC: 02:42:0a:01:00:02
Starting arp-scan 1.9.7 with 256 hosts
10.0.0.1    02:42:0a:01:00:01    (Unknown)
10.0.0.10   02:42:0a:01:00:0a    (Unknown)
```

```pagebreak
```

**Step 3:** Perform banner grabbing with Netcat

Netcat is one of the simplest tools for grabbing banners. Connect to an open port and the service will usually respond with its version string.

```bash
nc -nv 10.0.0.10 22
```

Expected output:

```
(UNKNOWN) [10.0.0.10] 22 (ssh) open
SSH-2.0-OpenSSH_8.9p1 Ubuntu-3ubuntu0.1
```

> [!info] What is a banner?
> A banner is a message sent by a network service when a client connects to it. It usually contains the service name, version, and sometimes the operating system. This information is useful for identifying vulnerable versions during a penetration test.

**Step 4:** Perform banner grabbing with Nmap

Nmap's `-sV` flag probes open ports to determine the service and version running behind them.

```bash
nmap -sV -p 21,22,80,443 10.0.0.10
```

| Port | State | Service | Version |
|------|-------|---------|---------|
| 21/tcp | open | ftp | vsftpd 3.0.3 |
| 22/tcp | open | ssh | OpenSSH 8.9 |
| 80/tcp | open | http | Apache 2.4.52 |
| 443/tcp | closed | https | — |

```pagebreak
```

**Step 5:** Perform banner grabbing with curl

For HTTP services, `curl` can retrieve the server header which often reveals the web server version.

```bash
curl -I http://10.0.0.10
```

```
HTTP/1.1 200 OK
Date: Mon, 19 Mar 2026 10:00:00 GMT
Server: Apache/2.4.52 (Ubuntu)
Content-Type: text/html; charset=UTF-8
```

**Step 6:** Perform banner grabbing with Metasploit

Metasploit includes several auxiliary modules for banner grabbing across different protocols.

```bash
msfconsole -q
use auxiliary/scanner/portscan/tcp
set RHOSTS 10.0.0.10
set PORTS 21,22,80
run
```

> [!warning] Note
> Always ensure you have written authorization before performing any scanning or banner grabbing activity on a target system.

## Summary

In this task we used four different tools to perform banner grabbing against a target machine. The results are summarized below:

| Tool | Protocol | Info obtained |
|------|----------|---------------|
| Netcat | SSH (22) | OpenSSH 8.9p1 Ubuntu |
| Nmap | FTP, SSH, HTTP | Full service versions |
| curl | HTTP (80) | Apache 2.4.52 Ubuntu |
| Metasploit | TCP scan | Open ports confirmed |

Banner grabbing is a passive reconnaissance technique that gives you a quick overview of the attack surface before moving into active exploitation phases.
