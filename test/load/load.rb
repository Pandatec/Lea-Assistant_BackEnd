# frozen_string_literal: true

require("open3")

CLIENT_COUNT=1024

def test
  puts "[LEA WEBSOCKET LOAD TEST PROGRAM]"
  server_ready = false
  want_server = "HTTP server running on port: 80"

  server_process_pid = nil
  server_thread = Thread.new do |t|
    server_process = Open3.popen2e("npm", "start") do |stdin, stdout, status_thread|
      stdout.each_line do |line|
        puts "[SERVER]: #{line}"
        server_process_pid = status_thread.pid
        if line.include? want_server
          server_ready = true
        end
      end
      raise "[SERVER CRASHED]"  unless status_thread.value.success?
    end
  end

  while !server_ready
  end
  puts "SERVER STARTED!!"
  sleep 1
  puts "[GET YOUR ASS READY]: LIONS ABOUT TO GET UNLEASHED!!"
  sleep 5

  #max = 100000
  max = 100
  client_threads = []
  (0..0).each do |i|
    client_threads << Thread.new do
      Open3.popen2e("npm", "run", "test_load", "--", "count=#{CLIENT_COUNT}") do |stdin, stdout, status_thread|
        stdout.each_line do |line|
          puts "[CLIENT #{i}]: #{line}"
        end
        raise "[CLIENT #{i} CRASHED]"  unless status_thread.value.success?
      end
    end
  end

  client_threads.each do |t|
    t.join
  end

  puts "ALL CLIENTS JOINED, SOON INTERRUPTING SERVER"
  sleep 2
  Process.kill("INT", server_process_pid)
  server_thread.join
  puts "DONE."
end

test
